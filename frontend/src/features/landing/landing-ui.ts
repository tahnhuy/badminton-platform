import type { MotionProps } from 'motion/react';

/** Presentation constants of the public landing page (AUTH-34, prototype `docs/design/smashpro-landing-v1`). */

export const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Content frame: 1320 px wide, 16 px gutter on phones and 32 px from 721 px. Bands stay full-bleed. */
export const CONTAINER = 'mx-auto w-full max-w-330 px-4 min-[45.0625rem]:px-8';

/** Visible focus: lime outline on the forest surfaces, brand ring on light ones. */
export const FOCUS_ON_DARK = 'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-brand-lime';
export const FOCUS_ON_LIGHT = 'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring';

/** In-page sections linked from the header navigation, in page order. */
export const LANDING_SECTIONS = [
  { id: 'features', label: 'Tính năng' },
  { id: 'how', label: 'Cách bắt đầu' },
  { id: 'levels', label: 'Trình độ' },
  { id: 'owners', label: 'Chủ sân' },
] as const;
export type LandingSectionId = (typeof LANDING_SECTIONS)[number]['id'];

/** Sections are anchor targets below the fixed header; focusable so in-page links move focus too. */
export const SECTION_TARGET = 'scroll-mt-20 focus:outline-none min-[45.0625rem]:scroll-mt-22';

/** Lime call to action on the forest surfaces, with the shine sweep of the approved prototype. */
export const LIME_CTA = [
  'group relative isolate inline-flex min-h-13 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-lg bg-brand-lime px-6 text-base font-bold text-brand-forest',
  'shadow-[0_14px_30px_-14px_var(--color-brand-lime)] hover:brightness-105 motion-safe:transition-[translate,filter,box-shadow] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-98',
  'after:pointer-events-none after:absolute after:-inset-y-0.5 after:-left-3/5 after:w-2/5 after:-skew-x-18 after:bg-linear-100 after:from-transparent after:via-white/65 after:to-transparent motion-safe:after:animate-shine',
  FOCUS_ON_DARK,
].join(' ');

/** Secondary text link on the forest surfaces ("Tôi đã có tài khoản"). */
export const LIGHT_TEXT_LINK = `group inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-1.5 text-base font-bold text-white/90 hover:text-brand-lime ${FOCUS_ON_DARK}`;

/** Arrow nudged on hover; still under reduced motion. */
export const NUDGE_ICON = 'size-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-0.75';

/** Reveal on scroll (shortened to 300 ms per frontend.md §1); nothing is hidden or moved under reduced motion. */
export function reveal(reduce: boolean, index = 0): MotionProps {
  if (reduce) return {};
  return {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.18 },
    transition: { duration: 0.3, delay: index * 0.09, ease: EASE },
  };
}

/** Scrolls to an in-page section and moves focus there (keyboard and screen-reader users follow the link). */
export function goToSection(id: string, reduce: boolean) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  target.focus({ preventScroll: true });
}
