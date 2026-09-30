import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { parse as parseYaml } from 'yaml';
import i18n from '../src/i18n';
import { SectionAdvanced } from '../src/features/config/components/sections/SectionAdvanced';
import { findConfigFieldById, searchConfigFields } from '../src/features/config/searchIndex';
import { runVisualConfig } from './helpers/visualConfig';
import en from '../src/i18n/locales/en.json';
import zhCN from '../src/i18n/locales/zh-CN.json';
import zhTW from '../src/i18n/locales/zh-TW.json';
import ru from '../src/i18n/locales/ru.json';

describe('native Claude cache keepalive switch', () => {
  test('defaults off and loads the v8 setting independently of plugins', () => {
    expect(runVisualConfig('{}').visualValues.claudeCacheKeepalive).toBe(false);
    const state = runVisualConfig(
      'plugins: {enabled: false}\noauth: {providers: {claude: {cache-keepalive: true}}}\n'
    );
    expect(state.visualValues.claudeCacheKeepalive).toBe(true);
    expect(state.visualValues.pluginsEnabled).toBe(false);
    expect(state.visualDirty).toBe(false);
  });

  test('saves both switch values without changing sibling settings or comments', () => {
    for (const enabled of [true, false]) {
      const yaml = `# native keepalive
oauth:
  providers:
    claude:
      # retained setting
      cache-keepalive: ${!enabled}
      model-level-cooling: true
      header-defaults: {user-agent: custom-client}
    codex: {header-defaults: {user-agent: codex-client}}
plugins: {enabled: false}
`;
      const state = runVisualConfig(yaml, [{ claudeCacheKeepalive: enabled }]);
      expect([...state.visualDirtyFields]).toEqual(['claudeCacheKeepalive']);
      const saved = state.applyVisualChangesToYaml(yaml);
      const expected = parseYaml(yaml);
      expected.oauth.providers.claude['cache-keepalive'] = enabled;
      expect(parseYaml(saved)).toEqual(expected);
      expect(saved).toContain('# native keepalive');
      expect(saved).toContain('# retained setting');
      expect(runVisualConfig(saved).visualValues.claudeCacheKeepalive).toBe(enabled);
    }
  });

  test('creates missing or null provider containers', () => {
    for (const yaml of [
      '{}',
      'oauth: null',
      'oauth: {providers: null}',
      'oauth: {providers: {claude: null}}',
    ]) {
      const state = runVisualConfig(yaml, [{ claudeCacheKeepalive: true }]);
      expect(parseYaml(state.applyVisualChangesToYaml(yaml))).toEqual({
        oauth: { providers: { claude: { 'cache-keepalive': true } } },
      });
    }
  });

  test('restoring the original switch clears the unsaved-change indicator', () => {
    const yaml = 'oauth: {providers: {claude: {cache-keepalive: true}}}\n';
    const state = runVisualConfig(yaml, [
      { claudeCacheKeepalive: false },
      { claudeCacheKeepalive: true },
    ]);
    expect(state.visualDirty).toBe(false);
    expect(parseYaml(state.applyVisualChangesToYaml(yaml))).toEqual(parseYaml(yaml));
  });

  test('search resolves the switch to the advanced tab and canonical YAML path', () => {
    const path = 'oauth.providers.claude.cache-keepalive';
    expect(findConfigFieldById('claudeCacheKeepalive')).toMatchObject({
      sectionId: 'advanced',
      yamlKeys: path.split('.'),
    });
    expect(searchConfigFields(path, () => '').map((entry) => entry.fieldId)).toContain(
      'claudeCacheKeepalive'
    );
  });

  test('renders an accessible enabled switch and disables editing when disconnected', () => {
    const values = runVisualConfig(
      'oauth: {providers: {claude: {cache-keepalive: true}}}'
    ).visualValues;
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, {
        children: createElement(SectionAdvanced, {
          values,
          disabled: true,
          onChange: () => {},
        }),
      })
    );
    expect(markup).toContain('id="cfg-field-claudeCacheKeepalive"');
    const label = i18n.t('config_management.visual.sections.advanced.claude_cache_keepalive');
    expect(markup).toContain(`aria-label="${label}"`);
    const switchTag = markup.match(new RegExp(`<[^>]*aria-label="${label}"[^>]*>`))?.[0];
    expect(switchTag).toContain('disabled=""');
    expect(switchTag).toContain('checked=""');
    expect(markup).toContain('href="/logs?tab=keepalive"');
  });

  test('all locales explain renewal intervals and billable cache reads', () => {
    for (const locale of [en, zhCN, zhTW, ru]) {
      const section = locale.config_management.visual.sections.advanced;
      expect(section.claude_title).toBe('Claude');
      expect(section.claude_cache_keepalive.length).toBeGreaterThan(0);
      expect(section.claude_cache_keepalive_desc).toContain('50');
      expect(section.claude_cache_keepalive_desc).toContain('4');
    }
  });
});
