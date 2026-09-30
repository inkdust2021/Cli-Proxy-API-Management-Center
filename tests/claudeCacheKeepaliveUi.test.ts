import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '../src/i18n/locales/en.json';
import zhCN from '../src/i18n/locales/zh-CN.json';
import zhTW from '../src/i18n/locales/zh-TW.json';
import ru from '../src/i18n/locales/ru.json';
import { KeepaliveEvents } from '@/features/logs/KeepaliveEvents';
import { filterKeepaliveEvents } from '@/features/logs/model/keepaliveLogs';
import type { ClaudeCacheKeepaliveEvent } from '@/services/api/claudeCacheKeepalive';

const events: ClaudeCacheKeepaliveEvent[] = [
  {
    id: 2,
    time: '2026-09-30T10:00:00Z',
    outcome: 'renewed',
    model: 'claude-sonnet-5',
    account: 'abc',
    session: 'def',
    cacheReadTokens: 1200,
    durationMs: 42,
    paused: false,
    statusCode: 0,
  },
  {
    id: 1,
    time: '2026-09-30T09:00:00Z',
    outcome: 'failed',
    model: 'claude-opus-5',
    account: 'xyz',
    session: 'ghi',
    cacheReadTokens: 0,
    durationMs: 50,
    paused: true,
    statusCode: 429,
  },
];
const i18n = createInstance();
await i18n.init({
  lng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});
const renderEvents = (items: ClaudeCacheKeepaliveEvent[]) =>
  renderToStaticMarkup(
    createElement(I18nextProvider, {
      i18n,
      children: createElement(KeepaliveEvents, { events: items }),
    })
  );

describe('Claude keepalive event viewer', () => {
  test('filters by result and model or opaque identity without losing source history', () => {
    expect(filterKeepaliveEvents(events, 'failed', 'OPUS')).toEqual([events[1]]);
    expect(filterKeepaliveEvents(events, 'all', 'abc')).toEqual([events[0]]);
    expect(filterKeepaliveEvents(events, 'renewed', 'xyz')).toEqual([]);
    expect(events).toHaveLength(2);
  });

  test('renders a readable event table with cache usage, status and pause details', () => {
    const html = renderEvents(events);
    expect(html).toContain('<table');
    expect(html).toContain('claude-sonnet-5');
    expect(html).toContain('1,200');
    expect(html).toContain('429');
    expect(html).toContain('42 ms');
    expect(html).toContain('abc / def');
    expect(html).not.toContain('Bearer');
  });

  test('renders an explicit empty state', () => {
    const html = renderEvents([]);
    expect(html).not.toContain('<table');
    expect(html).toContain('keepalive');
  });

  test('all locales include the same labels and interpolation parameters', () => {
    for (const locale of [zhCN, zhTW, ru]) {
      expect(Object.keys(locale.logs.keepalive).sort()).toEqual(
        Object.keys(en.logs.keepalive).sort()
      );
      expect(Object.keys(locale.logs.keepalive.outcomes).sort()).toEqual(
        Object.keys(en.logs.keepalive.outcomes).sort()
      );
      for (const key of ['sessions', 'retention'] as const) {
        expect(locale.logs.keepalive[key].match(/\{\{\w+\}\}/g)).toEqual(
          en.logs.keepalive[key].match(/\{\{\w+\}\}/g)
        );
      }
    }
  });
});
