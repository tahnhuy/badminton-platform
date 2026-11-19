import type { KeyboardEvent } from 'react';

/** Preserve content-focus Tab entry while Radix handles focus boundaries and scroll locking. */
export function focusDialogEdge(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Tab' || event.target !== event.currentTarget) return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]')).filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && node.offsetParent !== null);
  event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
}
