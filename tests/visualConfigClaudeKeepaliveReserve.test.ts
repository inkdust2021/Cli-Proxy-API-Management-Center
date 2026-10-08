import { expect, test } from 'bun:test';
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

const field = 'claudeCacheKeepaliveReserveQuota';
const path = 'oauth.providers.claude.cache-keepalive-reserve-quota';

test('reserve defaults off and updates only its setting with dirty tracking', () => {
  expect(runVisualConfig('{}').visualValues.claudeCacheKeepaliveReserveQuota).toBe(false);
  for (const enabled of [true, false]) {
    const yaml = `# quota reserve\noauth:\n  providers:\n    claude:\n      cache-keepalive: true\n      cache-keepalive-reserve-quota: ${!enabled}\n      cache-keepalive-disabled-sessions: [opaque-session]\n      header-defaults: {user-agent: custom}\n    codex: {unknown: unchanged}\n`;
    const state = runVisualConfig(yaml, [{ claudeCacheKeepaliveReserveQuota: enabled }]);
    expect([...state.visualDirtyFields]).toEqual([field]);
    const saved = state.applyVisualChangesToYaml(yaml);
    const expected = parseYaml(yaml);
    expected.oauth.providers.claude['cache-keepalive-reserve-quota'] = enabled;
    expect(parseYaml(saved)).toEqual(expected);
    expect(saved).toContain('# quota reserve');
    expect(runVisualConfig(saved).visualValues.claudeCacheKeepaliveReserveQuota).toBe(enabled);
    expect(
      runVisualConfig(yaml, [
        { claudeCacheKeepaliveReserveQuota: enabled },
        { claudeCacheKeepaliveReserveQuota: !enabled },
      ]).visualDirty
    ).toBe(false);
  }
});

test('reserve creates missing provider containers without enabling keepalive', () => {
  for (const yaml of ['{}', 'oauth: null', 'oauth: {providers: {claude: null}}']) {
    const state = runVisualConfig(yaml, [{ claudeCacheKeepaliveReserveQuota: true }]);
    expect(parseYaml(state.applyVisualChangesToYaml(yaml))).toEqual({
      oauth: { providers: { claude: { 'cache-keepalive-reserve-quota': true } } },
    });
  }
});

test('reserve search and accessible switch describe both windows in each locale', () => {
  expect(findConfigFieldById(field)).toMatchObject({
    sectionId: 'advanced',
    yamlKeys: path.split('.'),
  });
  expect(searchConfigFields(path, () => '').map((entry) => entry.fieldId)).toContain(field);
  const values = runVisualConfig(
    'oauth: {providers: {claude: {cache-keepalive-reserve-quota: true}}}'
  ).visualValues;
  const html = renderToStaticMarkup(
    createElement(MemoryRouter, {
      children: createElement(SectionAdvanced, { values, disabled: true, onChange: () => {} }),
    })
  );
  const label = i18n.t(
    'config_management.visual.sections.advanced.claude_cache_keepalive_reserve_quota'
  );
  expect(html).toContain(`id="cfg-field-${field}"`);
  const tag = html.match(new RegExp(`<[^>]*aria-label="${label}"[^>]*>`))?.[0];
  expect(tag).toContain('disabled=""');
  expect(tag).toContain('checked=""');
  for (const locale of [en, zhCN, zhTW, ru]) {
    const section = locale.config_management.visual.sections.advanced;
    expect(section.claude_cache_keepalive_reserve_quota).toContain('1%');
    expect(section.claude_cache_keepalive_reserve_quota_desc).toContain('1%');
    expect(section.claude_cache_keepalive_reserve_quota_desc).toContain('5');
  }
});
