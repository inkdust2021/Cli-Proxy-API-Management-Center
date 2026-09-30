import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/EmptyState';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import type { ClaudeCacheKeepaliveSession } from '@/services/api/claudeCacheKeepalive';

export function KeepaliveSessions({
  sessions,
  onToggle,
  disabled,
}: {
  sessions: ClaudeCacheKeepaliveSession[];
  onToggle: (session: ClaudeCacheKeepaliveSession, enabled: boolean) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  if (!sessions.length)
    return (
      <EmptyState
        title={t('logs.keepalive.no_sessions')}
        description={t('logs.keepalive.session_hint')}
      />
    );
  return (
    <table aria-label={t('logs.keepalive.session_title')}>
      <thead>
        <tr>
          {[
            'model',
            'identity',
            'last_prompt',
            'session_state',
            'last_activity',
            'next_renewal',
            'renew_session',
          ].map((key) => (
            <th key={key} scope="col">
              {t(`logs.keepalive.${key}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sessions.map((session) => (
          <tr key={session.id}>
            <td>{session.model || '—'}</td>
            <td>{session.account ? `${session.account} / ${session.session}` : session.session}</td>
            <td className="keepalive-prompt">
              {session.lastPrompt.length > 160 ? (
                <details>
                  <summary>{session.lastPrompt.slice(0, 160)}…</summary>
                  <p>{session.lastPrompt}</p>
                </details>
              ) : (
                session.lastPrompt || t('logs.keepalive.prompt_unavailable')
              )}
            </td>
            <td>
              <span
                className={`status-badge ${session.state === 'active' ? 'success' : 'warning'}`}
              >
                {t(`logs.keepalive.states.${session.state}`)}
              </span>
            </td>
            <td>
              {session.lastActivity ? (
                <time dateTime={session.lastActivity}>
                  {new Date(session.lastActivity).toLocaleString()}
                </time>
              ) : (
                '—'
              )}
            </td>
            <td>
              {session.nextRenewal ? (
                <time dateTime={session.nextRenewal}>
                  {new Date(session.nextRenewal).toLocaleString()}
                </time>
              ) : (
                '—'
              )}
            </td>
            <td>
              <ToggleSwitch
                checked={session.state !== 'disabled'}
                disabled={disabled}
                ariaLabel={t('logs.keepalive.toggle_session', { session: session.session })}
                onChange={(enabled) => onToggle(session, enabled)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
