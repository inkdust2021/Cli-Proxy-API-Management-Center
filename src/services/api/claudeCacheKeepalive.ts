import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';

export const KEEPALIVE_OUTCOMES = [
  'enabled',
  'disabled',
  'tracked',
  'renewed',
  'cache_miss',
  'failed',
  'cancelled',
  'expired',
  'session_enabled',
  'session_disabled',
] as const;
export type KeepaliveOutcome = (typeof KEEPALIVE_OUTCOMES)[number];

export interface ClaudeCacheKeepaliveEvent {
  id: number;
  time: string;
  outcome: KeepaliveOutcome;
  model: string;
  account: string;
  session: string;
  cacheReadTokens: number;
  durationMs: number;
  paused: boolean;
  statusCode: number;
}

export const KEEPALIVE_SESSION_STATES = [
  'active',
  'disabled',
  'paused',
  'expired',
  'renewing',
  'updating',
] as const;
export interface ClaudeCacheKeepaliveSession {
  id: string;
  model: string;
  account: string;
  session: string;
  lastPrompt: string;
  state: (typeof KEEPALIVE_SESSION_STATES)[number];
  lastActivity: string;
  nextRenewal: string;
}

export interface ClaudeCacheKeepaliveLogs {
  enabled: boolean;
  sessions: number;
  pausedSessions: number;
  capacity: number;
  disabledSessions: number;
  supportsSessions: boolean;
  sessionDetails: ClaudeCacheKeepaliveSession[];
  events: ClaudeCacheKeepaliveEvent[];
}

const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
const text = (value: unknown) => (typeof value === 'string' ? value : '');

const timestamp = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) && !value.startsWith('0001-')
    ? value
    : '';

export const claudeCacheKeepaliveApi = {
  async deleteSession(id: string, options: { signal?: AbortSignal } = {}) {
    await apiClient.delete(
      `/observability/claude-cache-keepalive/sessions/${encodeURIComponent(id)}`,
      options
    );
  },
  async setSessionEnabled(id: string, enabled: boolean, options: { signal?: AbortSignal } = {}) {
    await apiClient.patch(
      `/observability/claude-cache-keepalive/sessions/${encodeURIComponent(id)}`,
      { enabled },
      options
    );
  },
  async getLogs(options: { signal?: AbortSignal } = {}): Promise<ClaudeCacheKeepaliveLogs> {
    const raw: unknown = await apiClient.get('/observability/claude-cache-keepalive', options);
    const data = isRecord(raw) ? raw : {};
    const events = (Array.isArray(data.events) ? data.events : [])
      .flatMap((event): ClaudeCacheKeepaliveEvent[] => {
        if (
          !isRecord(event) ||
          count(event.id) === 0 ||
          !Number.isFinite(Date.parse(text(event.time))) ||
          !KEEPALIVE_OUTCOMES.includes(event.outcome as KeepaliveOutcome)
        )
          return [];
        const status = count(event.status_code);
        return [
          {
            id: count(event.id),
            time: text(event.time),
            outcome: event.outcome as KeepaliveOutcome,
            model: text(event.model),
            account: text(event.account),
            session: text(event.session),
            cacheReadTokens: count(event.cache_read_tokens),
            durationMs: count(event.duration_ms),
            paused: event.paused === true,
            statusCode: status >= 100 && status <= 599 ? status : 0,
          },
        ];
      })
      .slice(0, 200);
    return {
      enabled: data.enabled === true,
      sessions: count(data.sessions),
      pausedSessions: count(data.paused_sessions),
      capacity: count(data.capacity) || 200,
      events,
      disabledSessions: count(data.disabled_sessions),
      supportsSessions: Array.isArray(data.session_details),
      sessionDetails: (Array.isArray(data.session_details) ? data.session_details : []).flatMap(
        (item): ClaudeCacheKeepaliveSession[] => {
          if (
            !isRecord(item) ||
            !/^[a-f0-9]{64}$/.test(text(item.id)) ||
            !KEEPALIVE_SESSION_STATES.includes(item.state as ClaudeCacheKeepaliveSession['state'])
          )
            return [];
          return [
            {
              id: text(item.id),
              model: text(item.model),
              account: text(item.account),
              session: text(item.session),
              lastPrompt: text(item.last_prompt),
              state: item.state as ClaudeCacheKeepaliveSession['state'],
              lastActivity: timestamp(item.last_activity),
              nextRenewal: timestamp(item.next_renewal),
            },
          ];
        }
      ),
    };
  },
};
