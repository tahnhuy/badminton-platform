import { useState } from 'react';

/**
 * Radix dialogs only return focus to their own Trigger. A dialog mounted from state (no Trigger) passes this
 * to `onCloseAutoFocus` to return focus to the element that was focused when it mounted.
 */
export function useReturnFocus() {
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  return (event: Event) => { if (opener?.isConnected) { event.preventDefault(); opener.focus(); } };
}
