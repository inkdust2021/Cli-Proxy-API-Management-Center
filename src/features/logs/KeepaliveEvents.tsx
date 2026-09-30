import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ClaudeCacheKeepaliveEvent } from '@/services/api/claudeCacheKeepalive';

export function KeepaliveEvents({ events }: { events: ClaudeCacheKeepaliveEvent[] }) {
  const { t } = useTranslation();
  if (!events.length) {
    return (
      <EmptyState title={t('logs.keepalive.empty')} description={t('logs.keepalive.empty_desc')} />
    );
  }
  return (
    <table aria-label={t('logs.keepalive.title')}>
      <thead>
        <tr>
          {['time', 'model', 'identity', 'result', 'cache_read', 'duration'].map((key) => (
            <th key={key} scope="col">
              {t(`logs.keepalive.${key}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <tr key={event.id}>
            <td>
              <time dateTime={event.time}>{new Date(event.time).toLocaleString()}</time>
            </td>
            <td>{event.model || '—'}</td>
            <td>{event.account ? `${event.account} / ${event.session}` : '—'}</td>
            <td>
              <span
                className={`status-badge ${event.outcome === 'failed' ? 'error' : event.outcome === 'renewed' ? 'success' : 'warning'}`}
              >
                {t(`logs.keepalive.outcomes.${event.outcome}`)}
              </span>
              {event.statusCode > 0 && <div>HTTP {event.statusCode}</div>}
              {event.paused && <div>{t('logs.keepalive.paused')}</div>}
            </td>
            <td>{event.cacheReadTokens.toLocaleString()}</td>
            <td>{event.durationMs.toLocaleString()} ms</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
