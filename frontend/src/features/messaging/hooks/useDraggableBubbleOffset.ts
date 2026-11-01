import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'badminton_chat_bubble_bottom_offset';
const DEFAULT_BOTTOM = 24;
const MIN_BOTTOM = 16;
const BUBBLE_HEIGHT = 56;
const HEADER_SAFE_GAP = 18;

export function getHeaderBottomPx(): number {
  if (typeof document === 'undefined') return 76;
  const headerEl =
    document.querySelector('.player-header-inner')?.parentElement ||
    document.querySelector('header');
  if (headerEl) {
    const rect = headerEl.getBoundingClientRect();
    if (rect.bottom > 0 && rect.bottom < 200) {
      return Math.max(73, Math.ceil(rect.bottom));
    }
  }
  return 76;
}

function clampBottom(val: number): number {
  if (typeof window === 'undefined') return DEFAULT_BOTTOM;
  const headerBottom = getHeaderBottomPx();
  const maxBottom = Math.max(
    MIN_BOTTOM,
    window.innerHeight - (headerBottom + HEADER_SAFE_GAP + BUBBLE_HEIGHT)
  );
  return Math.min(Math.max(MIN_BOTTOM, Math.round(val)), maxBottom);
}

export function useDraggableBubbleOffset() {
  const [bottomOffset, setBottomOffset] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_BOTTOM;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const num = Number(saved);
        if (Number.isFinite(num)) {
          return clampBottom(num);
        }
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_BOTTOM;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    active: boolean;
    startY: number;
    startBottom: number;
    moved: boolean;
  }>({
    active: false,
    startY: 0,
    startBottom: DEFAULT_BOTTOM,
    moved: false,
  });

  useEffect(() => {
    const syncClamp = () => {
      setBottomOffset((prev) => {
        const clamped = clampBottom(prev);
        if (clamped !== prev) {
          try {
            window.localStorage.setItem(STORAGE_KEY, String(clamped));
          } catch {
            // ignore
          }
        }
        return clamped;
      });
    };
    syncClamp();
    window.addEventListener('resize', syncClamp);
    return () => window.removeEventListener('resize', syncClamp);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStateRef.current = {
        active: true,
        startY: e.clientY,
        startBottom: bottomOffset,
        moved: false,
      };
      setIsDragging(false);
    },
    [bottomOffset]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const st = dragStateRef.current;
    if (!st.active) return;

    const deltaY = st.startY - e.clientY;
    if (Math.abs(deltaY) > 5) {
      st.moved = true;
      setIsDragging(true);
    }

    if (st.moved) {
      const next = clampBottom(st.startBottom + deltaY);
      setBottomOffset(next);
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const st = dragStateRef.current;
      if (!st.active) return;
      st.active = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDragging(false);

      if (st.moved) {
        try {
          window.localStorage.setItem(STORAGE_KEY, String(bottomOffset));
        } catch {
          // ignore
        }
      }
    },
    [bottomOffset]
  );

  const consumeWasDragged = useCallback((): boolean => {
    const wasMoved = dragStateRef.current.moved;
    dragStateRef.current.moved = false;
    return wasMoved;
  }, []);

  return {
    bottomOffset,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    consumeWasDragged,
  };
}

