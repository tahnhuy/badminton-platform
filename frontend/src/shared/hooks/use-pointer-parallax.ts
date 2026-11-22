import { useEffect, type PointerEvent } from 'react';
import { useMotionValue, useSpring } from 'motion/react';
import { useMediaQuery } from './use-media-query';

/** Pointer-only presentation: Motion schedules frames without React state updates. */
export function usePointerParallax() {
  // Motion's installed useReducedMotion snapshots this preference at mount.
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const pointerAngle = useMotionValue(0);
  const spring = { stiffness: 260, damping: 30 };
  const x = useSpring(pointerX, spring);
  const y = useSpring(pointerY, spring);
  const rotate = useSpring(pointerAngle, spring);
  const reset = () => { pointerX.set(0); pointerY.set(0); pointerAngle.set(0); };

  useEffect(() => {
    if (reducedMotion || !finePointer) {
      pointerX.set(0); pointerY.set(0); pointerAngle.set(0);
      x.jump(0); y.jump(0); rotate.jump(0);
    }
  }, [reducedMotion, finePointer, x, y, rotate, pointerX, pointerY, pointerAngle]);

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (reducedMotion || !finePointer || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    const horizontal = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
    const vertical = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
    pointerX.set(horizontal * 6);
    pointerY.set(vertical * 4);
    pointerAngle.set(horizontal * 0.6);
  };
  return { style: { x, y, rotate }, onPointerMove, onPointerLeave: reset };
}
