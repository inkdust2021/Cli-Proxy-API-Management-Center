import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useAuthStore, useConfigStore, useNotificationStore } from '@/stores';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { getErrorMessage } from '@/utils/helpers';
import {
  claudeCacheKeepaliveApi,
  KEEPALIVE_OUTCOMES,
  type ClaudeCacheKeepaliveLogs,
  type ClaudeCacheKeepaliveSession,
} from '@/services/api/claudeCacheKeepalive';
import { createLogRequestGuard } from './model/logRequests';
import { KeepaliveSessions } from './KeepaliveSessions';
import { KeepaliveEvents } from './KeepaliveEvents';
import { filterKeepaliveEvents, filterKeepaliveSessions } from './model/keepaliveLogs';
import styles from './KeepaliveLogsPanel.module.scss';

export function KeepaliveLogsPanel() {
  const { t } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const [data, setData] = useState<ClaudeCacheKeepaliveLogs | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [query, setQuery] = useState('');
  const [sessionQuery, setSessionQuery] = useState('');
  const [mutating, setMutating] = useState(false);
  const mutationRef = useRef(false);
  const connectionGenerationRef = useRef(0);
  const [outcome, setOutcome] = useState('all');
  const [guard] = useState(createLogRequestGuard);
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (useAuthStore.getState().connectionStatus !== 'connected' || requestRef.current) return;
    const request = guard.invalidate();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const snapshot = await claudeCacheKeepaliveApi.getLogs({ signal: controller.signal });
      if (!guard.isCurrent(request)) return;
      setData(snapshot);
      setError('');
    } catch (err: unknown) {
      if (!guard.isCurrent(request)) return;
      const status = typeof err === 'object' && err !== null && 'status' in err ? err.status : 0;
      setError(
        status === 404
          ? t('logs.keepalive.unsupported')
          : getErrorMessage(err) || t('logs.load_error')
      );
    } finally {
      if (guard.isCurrent(request)) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [guard, t]);
  useHeaderRefresh(refresh);

  const updateSession = async (change: (signal: AbortSignal) => Promise<void>) => {
    if (useAuthStore.getState().connectionStatus !== 'connected' || mutationRef.current) return;
    const request = guard.invalidate();
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    mutationRef.current = true;
    setMutating(true);
    setLoading(true);
    setError('');
    try {
      await change(controller.signal);
      if (!guard.isCurrent(request)) return;
      useConfigStore.getState().clearCache();
      const snapshot = await claudeCacheKeepaliveApi.getLogs({ signal: controller.signal });
      if (guard.isCurrent(request)) setData(snapshot);
    } catch (err: unknown) {
      if (guard.isCurrent(request)) setError(getErrorMessage(err) || t('logs.load_error'));
    } finally {
      if (guard.isCurrent(request)) {
        requestRef.current = null;
        mutationRef.current = false;
        setMutating(false);
        setLoading(false);
      }
    }
  };

  const toggleSession = (session: ClaudeCacheKeepaliveSession, enabled: boolean) =>
    updateSession((signal) =>
      claudeCacheKeepaliveApi.setSessionEnabled(session.id, enabled, { signal })
    );

  const deleteSession = (session: ClaudeCacheKeepaliveSession) => {
    const connection = connectionGenerationRef.current;
    useNotificationStore.getState().showConfirmation({
      title: t('logs.keepalive.delete_session_title'),
      message: t('logs.keepalive.delete_session_confirm', { session: session.session }),
      confirmText: t('logs.keepalive.delete_session'),
      variant: 'danger',
      onConfirm: async () => {
        if (connection !== connectionGenerationRef.current) return;
        await updateSession((signal) => claudeCacheKeepaliveApi.deleteSession(session.id, { signal }));
      },
    });
  };

  useEffect(() => {
    const invalidate = () => {
      connectionGenerationRef.current++;
      guard.invalidate();
      requestRef.current?.abort();
      requestRef.current = null;
      mutationRef.current = false;
    };
    const unsubscribe = useAuthStore.subscribe((next, previous) => {
      if (
        next.apiBase !== previous.apiBase ||
        next.managementKey !== previous.managementKey ||
        next.connectionStatus !== previous.connectionStatus ||
        next.isAuthenticated !== previous.isAuthenticated
      ) {
        invalidate();
        setData(null);
        setError('');
        setLoading(false);
        setMutating(false);
        setSessionQuery('');
      }
    });
    return () => {
      unsubscribe();
      invalidate();
    };
  }, [guard]);

  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    void refresh();
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [connectionStatus, apiBase, managementKey, autoRefresh, refresh]);

  const events = filterKeepaliveEvents(data?.events ?? [], outcome, query);
  const disabled = connectionStatus !== 'connected';
  return (
    <Card
      className={styles.panel}
      title={t('logs.keepalive.manager_title')}
      extra={
        <Button
          variant="secondary"
          size="sm"
          loading={loading}
          disabled={disabled}
          onClick={() => void refresh()}
        >
          {t('common.refresh')}
        </Button>
      }
    >
      <div className={styles.summary}>
        <span className={`status-badge ${data?.enabled ? 'success' : 'warning'}`}>
          {data ? t(data.enabled ? 'logs.keepalive.enabled' : 'logs.keepalive.disabled') : '—'}
        </span>
        {data && (
          <span>
            {t('logs.keepalive.sessions', { count: data.sessions, paused: data.pausedSessions })}
            {' · '}
            {t('logs.keepalive.disabled_count', { count: data.disabledSessions })}
          </span>
        )}
        <Link to="/config?field=claudeCacheKeepalive">{t('logs.keepalive.settings')}</Link>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className={styles.content} aria-busy={loading}>
        <section className={styles.sessions} aria-label={t('logs.keepalive.session_title')}>
          <h3>{t('logs.keepalive.session_title')}</h3>
          <p className="hint">{t('logs.keepalive.session_hint')}</p>
          <Input
            value={sessionQuery}
            onChange={(e) => setSessionQuery(e.target.value)}
            placeholder={t('logs.keepalive.session_search')}
            aria-label={t('logs.keepalive.session_search')}
          />
          <div className={styles.tableScroll}>
            {loading && !data ? (
              <div className="hint">{t('common.loading')}</div>
            ) : data && !data.supportsSessions ? (
              <p className="hint">{t('logs.keepalive.session_unsupported')}</p>
            ) : (
              <KeepaliveSessions
                sessions={filterKeepaliveSessions(data?.sessionDetails ?? [], sessionQuery)}
                disabled={disabled || mutating}
                onToggle={(session, enabled) => void toggleSession(session, enabled)}
                onDelete={deleteSession}
              />
            )}
          </div>
        </section>
        <h3>{t('logs.keepalive.event_title')}</h3>
        <p className="hint">{t('logs.keepalive.retention', { count: data?.capacity ?? 200 })}</p>
        <div className={styles.controls}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('logs.keepalive.search')}
            aria-label={t('logs.keepalive.search')}
          />
          <Select
            className={styles.resultFilter}
            fullWidth={false}
            value={outcome}
            onChange={setOutcome}
            ariaLabel={t('logs.keepalive.result')}
            options={[
              { value: 'all', label: t('logs.keepalive.all') },
              ...KEEPALIVE_OUTCOMES.map((value) => ({
                value,
                label: t(`logs.keepalive.outcomes.${value}`),
              })),
            ]}
          />
          <ToggleSwitch
            checked={autoRefresh}
            onChange={setAutoRefresh}
            disabled={disabled}
            label={t('logs.keepalive.auto_refresh')}
          />
        </div>
        <div className={styles.events} aria-busy={loading}>
          {loading && !data ? (
            <div className="hint">{t('common.loading')}</div>
          ) : !error || data ? (
            <KeepaliveEvents events={events} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}
