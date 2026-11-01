import { useEffect, useRef, useState } from 'react';
import { messagingApi } from '../services/messaging-api';
import type { MessagingWsEnvelope } from '../types/messaging.types';

export type WsConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

interface UseMessagingSocketOptions {
  enabled?: boolean;
  onEvent?: (envelope: MessagingWsEnvelope) => void;
  onReconnect?: () => void;
}

export function useMessagingSocket(options: UseMessagingSocketOptions = {}) {
  const { enabled = true, onEvent, onReconnect } = options;
  const [connectionState, setConnectionState] = useState<WsConnectionState>('CONNECTING');

  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);

  useEffect(() => {
    onEventRef.current = onEvent;
    onReconnectRef.current = onReconnect;
  }, [onEvent, onReconnect]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;
    let attempt = 0;
    let hadConnectedOnce = false;

    const connect = () => {
      if (disposed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/api/v1/ws/messaging`;

      setConnectionState('CONNECTING');
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (disposed) return;
        attempt = 0;
        setConnectionState('CONNECTED');
        if (hadConnectedOnce) {
          onReconnectRef.current?.();
        }
        hadConnectedOnce = true;
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        try {
          const parsed = JSON.parse(event.data) as MessagingWsEnvelope;
          onEventRef.current?.(parsed);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = (event) => {
        if (disposed) return;
        setConnectionState('DISCONNECTED');
        // Do not auto-reconnect on 1008 policy violation (revoked session / suspended account)
        if (event.code === 1008) {
          return;
        }
        attempt += 1;
        const delayMs = Math.min(1000 * Math.pow(1.6, attempt), 10_000);
        reconnectTimer = window.setTimeout(connect, delayMs);
      };

      ws.onerror = () => {
        // onclose will handle reconnect
      };
    };

    connect();

    // Visibility-aware presence heartbeat (pauses when tab is hidden, fires on visible)
    const sendHeartbeatIfVisible = () => {
      if (document.visibilityState === 'visible') {
        messagingApi.recordHeartbeat().catch(() => {});
      }
    };

    sendHeartbeatIfVisible();
    const heartbeatInterval = window.setInterval(sendHeartbeatIfVisible, 25_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeatIfVisible();
        onReconnectRef.current?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      window.clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };
  }, [enabled]);

  return { connectionState };
}

