import type { ClaudeCacheKeepaliveEvent } from '@/services/api/claudeCacheKeepalive';

export function filterKeepaliveEvents(
  events: ClaudeCacheKeepaliveEvent[],
  outcome: string,
  query: string
) {
  const search = query.trim().toLowerCase();
  return events.filter(
    (event) =>
      (outcome === 'all' || event.outcome === outcome) &&
      (!search ||
        [event.model, event.account, event.session].some((value) =>
          value.toLowerCase().includes(search)
        ))
  );
}
