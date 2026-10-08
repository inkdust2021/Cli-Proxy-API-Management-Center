import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '../src/i18n/locales/en.json';
import { KeepaliveSessions } from '@/features/logs/KeepaliveSessions';
import { filterKeepaliveSessions } from '@/features/logs/model/keepaliveLogs';
import type { ClaudeCacheKeepaliveSession } from '@/services/api/claudeCacheKeepalive';

const sessions: ClaudeCacheKeepaliveSession[] = [
  {
    id: 'a'.repeat(64),
    model: 'claude-opus-5',
    account: 'abc',
    session: 'def',
    lastPrompt: '<script>Identify my coding conversation</script>',
    state: 'disabled',
    lastActivity: '2026-10-01T00:00:00Z',
    nextRenewal: '',
  },
];
const i18n = createInstance();
await i18n.init({
  lng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});
test('searches current sessions by prompt independently of event history', () => {
  expect(filterKeepaliveSessions(sessions, ' CODING ')).toEqual(sessions);
  expect(filterKeepaliveSessions(sessions, 'abc')).toEqual(sessions);
  expect(filterKeepaliveSessions(sessions, 'missing')).toEqual([]);
});
test('renders human prompt as escaped text and session renewal control', () => {
  const html = renderToStaticMarkup(
    createElement(I18nextProvider, {
      i18n,
      children: createElement(KeepaliveSessions, {
        sessions,
        onToggle: () => {},
        onDelete: () => {},
        disabled: false,
      }),
    })
  );
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('coding conversation');
  expect(html).toContain('type="checkbox"');
  expect(html).not.toContain('checked=""');
  expect(html).toContain('Renew session def');
  expect(html).toContain('Manually disabled');
});

test('offers an accessible deletion control even for disabled-only entries', () => {
  const disabledOnly = [{ ...sessions[0], model: '', account: '', lastPrompt: '', lastActivity: '' }];
  for (const disabled of [false, true]) {
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, {
        i18n,
        children: createElement(KeepaliveSessions, {
          sessions: disabledOnly,
          onToggle: () => {},
          onDelete: () => {},
          disabled,
        }),
      })
    );
    const button = html.match(/<button[^>]*aria-label="Delete session def"[^>]*>/)?.[0];
    expect(button).toBeDefined();
    expect(button?.includes('disabled=""')).toBe(disabled);
  }
});
