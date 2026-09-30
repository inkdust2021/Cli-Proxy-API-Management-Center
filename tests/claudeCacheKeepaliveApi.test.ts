import { describe, expect, spyOn, test } from 'bun:test';
import { apiClient } from '@/services/api/client';
import { claudeCacheKeepaliveApi } from '@/services/api/claudeCacheKeepalive';

describe('Claude cache keepalive logs API', () => {
  test('reads a non-destructive v8 snapshot and forwards cancellation', async () => {
    const get = spyOn(apiClient, 'get').mockResolvedValue({
      enabled: true,
      sessions: 2,
      paused_sessions: 1,
      capacity: 200,
      events: [
        {
          id: 3,
          time: '2026-09-30T10:00:00Z',
          outcome: 'renewed',
          model: 'claude-sonnet-5',
          account: 'abc',
          session: 'def',
          cache_read_tokens: 1200,
          duration_ms: 42,
          paused: false,
        },
      ],
    });
    try {
      const signal = new AbortController().signal;
      const data = await claudeCacheKeepaliveApi.getLogs({ signal });
      expect(get).toHaveBeenCalledWith('/observability/claude-cache-keepalive', { signal });
      expect(data).toEqual({
        enabled: true,
        sessions: 2,
        pausedSessions: 1,
        capacity: 200,
        events: [
          {
            id: 3,
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
        ],
      });
    } finally {
      get.mockRestore();
    }
  });

  test('normalizes malformed events and drops unrecognized private fields', async () => {
    const get = spyOn(apiClient, 'get').mockResolvedValue({
      enabled: 'false',
      sessions: -1,
      paused_sessions: null,
      capacity: 200,
      events: [
        null,
        { outcome: 'unknown' },
        {
          id: 1,
          time: '2026-09-30T10:00:00Z',
          outcome: 'failed',
          duration_ms: -1,
          cache_read_tokens: 'bad',
          paused: true,
          status_code: 429,
          error: 'Bearer secret',
        },
      ],
    });
    try {
      const data = await claudeCacheKeepaliveApi.getLogs();
      expect(data.enabled).toBe(false);
      expect(data.sessions).toBe(0);
      expect(data.events).toHaveLength(1);
      expect(data.events[0].statusCode).toBe(429);
      expect(data.events[0].durationMs).toBe(0);
      expect(JSON.stringify(data)).not.toContain('Bearer secret');
    } finally {
      get.mockRestore();
    }
  });

  test('keeps 404 responses visible instead of silently showing empty history', async () => {
    const error = Object.assign(new Error('not supported'), { status: 404 });
    const get = spyOn(apiClient, 'get').mockRejectedValue(error);
    try {
      await expect(claudeCacheKeepaliveApi.getLogs()).rejects.toBe(error);
    } finally {
      get.mockRestore();
    }
  });
});
