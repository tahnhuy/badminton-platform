import { useEffect, useState } from 'react';
import { messagingApi } from '../services/messaging-api';

/**
 * Total unread messages for shell badges. Refreshes when Messaging signals a change and when the
 * tab becomes visible again; failures keep the last known value.
 */
export function useUnreadMessages(): number {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      messagingApi.getUnreadSummary().then(r => setTotal(r.totalUnread)).catch(() => {});
    };
    refresh();
    window.addEventListener('messaging:unread-changed', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('messaging:unread-changed', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return total;
}
