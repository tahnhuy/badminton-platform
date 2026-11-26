import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tournamentKeys } from './queries';

/**
 * Realtime refresh of a tournament page (PRD FR-63, Tech Design §7.9; TRN-15).
 * Watches the tournament over the Messaging WebSocket; while the socket is up, polling stops
 * (see `useIsTournamentLive`); without a socket (visitor, Admin, Messaging off, offline) the
 * queries keep polling every 30 s. Refetches everything after a reconnect.
 */

const live = new Set<number>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const setLive = (id: number, value: boolean) => {
  if (live.has(id) === value) return;
  if (value) live.add(id); else live.delete(id);
  emit();
};

export function useIsTournamentLive(id: number): boolean {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    () => live.has(id),
    () => false,
  );
}

interface UpdatedEvent { type: string; data?: { tournamentId?: number; scope?: string } }

export function useTournamentLive(id: number, enabled: boolean) {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    let ws: WebSocket | null = null;
    let timer: number | null = null;
    let attempt = 0;
    let disposed = false;
    let connectedBefore = false;
    const refresh = () => {
      void client.invalidateQueries({ queryKey: tournamentKeys.one(id) });
      void client.invalidateQueries({ queryKey: ['tournaments', 'list'] });
    };

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws/messaging`);
      ws.onopen = () => {
        attempt = 0;
        ws?.send(JSON.stringify({ type: 'tournament.watch', tournamentId: id }));
        setLive(id, true);
        // Anything missed while disconnected is fetched again.
        if (connectedBefore) refresh();
        connectedBefore = true;
      };
      ws.onmessage = event => {
        try {
          const message = JSON.parse(String(event.data)) as UpdatedEvent;
          if (message.type === 'tournament.updated' && message.data?.tournamentId === id) refresh();
        } catch { /* ignore malformed frames */ }
      };
      ws.onclose = event => {
        setLive(id, false);
        if (disposed || event.code === 1008) return;
        attempt += 1;
        timer = window.setTimeout(connect, Math.min(1000 * 1.6 ** attempt, 15_000));
      };
    };
    connect();

    return () => {
      disposed = true;
      setLive(id, false);
      if (timer !== null) window.clearTimeout(timer);
      try {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'tournament.unwatch', tournamentId: id }));
        ws?.close();
      } catch { /* ignore */ }
    };
  }, [client, enabled, id]);
}
