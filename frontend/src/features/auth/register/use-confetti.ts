import { useEffect, useRef, type RefObject } from 'react';

const TOKEN_COLORS = ['--color-brand-lime', '--color-brand-mint', '--primary-foreground', '--color-brand-accent', '--color-caution-bg'];

/**
 * One confetti burst inside `canvasRef` (result screen). `canvas-confetti` is loaded
 * only when needed; it does nothing under reduced motion (`disableForReducedMotion`).
 * Colors come from the design tokens.
 */
export function useConfettiOnce(canvasRef: RefObject<HTMLCanvasElement | null>, enabled: boolean, delayMs: number) {
  const fired = useRef(false);
  useEffect(() => {
    if (!enabled || fired.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    let reset: (() => void) | undefined;
    const timer = window.setTimeout(async () => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const { default: confetti } = await import('canvas-confetti');
      if (cancelled) return;
      fired.current = true;
      const styles = getComputedStyle(document.documentElement);
      const colors = TOKEN_COLORS.map(name => styles.getPropertyValue(name).trim()).filter(value => /^#[0-9a-f]{6}$/i.test(value));
      const shoot = confetti.create(canvas, { resize: true, disableForReducedMotion: true });
      reset = () => shoot.reset();
      void shoot({ particleCount: 110, spread: 75, startVelocity: 38, origin: { x: 0.5, y: 0.32 }, ticks: 220, scalar: 0.9, colors: colors.length ? colors : undefined });
    }, delayMs);
    return () => { cancelled = true; window.clearTimeout(timer); reset?.(); };
  }, [canvasRef, enabled, delayMs]);
}
