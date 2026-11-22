import { useEffect, useState, type RefObject } from 'react';

/** True while the hero is still under the fixed header: the header stays transparent on the forest art. */
export function useHeaderOverHero(hero: RefObject<HTMLElement | null>, header: RefObject<HTMLElement | null>) {
  const [overHero, setOverHero] = useState(true);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const heroBottom = hero.current?.getBoundingClientRect().bottom ?? 0;
      setOverHero(heroBottom > (header.current?.offsetHeight ?? 0) + 4);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [hero, header]);
  return overHero;
}

/** The section crossing the middle of the viewport; null while the hero is there (no nav item is active). */
export function useActiveSection(hero: RefObject<HTMLElement | null>, ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const targets = [hero.current, ...ids.map(id => document.getElementById(id))].filter((node): node is HTMLElement => node !== null);
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target === hero.current ? null : entry.target.id);
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(target => observer.observe(target));
    return () => observer.disconnect();
  }, [hero, ids]);
  return active;
}

/** Whether an element is on screen (any pixel), starting from `initial` until the first observation. */
export function useOnScreen(target: RefObject<Element | null>, initial: boolean) {
  const [visible, setVisible] = useState(initial);
  useEffect(() => {
    if (!target.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(target.current);
    return () => observer.disconnect();
  }, [target]);
  return visible;
}
