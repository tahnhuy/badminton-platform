import { useEffect, useRef } from 'react';
import { domAnimation, LazyMotion } from 'motion/react';
import { SkipLink } from '@/components/common/skip-link';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { LandingHeader } from './landing-header';
import { LandingHero } from './landing-hero';
import { LevelsSection } from './landing-levels';
import { MobileActionBar } from './landing-mobile-bar';
import { ClosingCta, FeaturesSection, LandingFooter, OwnersSection, StepsSection } from './landing-sections';
import { LANDING_SECTIONS } from './landing-ui';
import { useActiveSection, useHeaderOverHero, useOnScreen } from './use-landing-scroll';

const SECTION_IDS = LANDING_SECTIONS.map(section => section.id);
const PAGE_TITLE = 'SmashPro — Hẹn nhau trên sân';

/**
 * Public landing page at `/` for visitors (AUTH-34; Auth PRD "Public landing page"; prototype
 * `docs/design/smashpro-landing-v1`). Static content; the only data read is the public skill-level catalog.
 */
export function LandingPage() {
  // Reactive preference: decorative motion stops as soon as the visitor asks for reduced motion.
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const headerRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const heroCtaRef = useRef<HTMLAnchorElement>(null);
  const finalCtaRef = useRef<HTMLAnchorElement>(null);
  const overHero = useHeaderOverHero(heroRef, headerRef);
  const active = useActiveSection(heroRef, SECTION_IDS);
  const heroCtaVisible = useOnScreen(heroCtaRef, true);
  const finalCtaVisible = useOnScreen(finalCtaRef, false);

  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => { document.title = previous; };
  }, []);

  return <LazyMotion features={domAnimation} strict>
    <div data-slot="landing-page" className="min-h-svh bg-background font-sans text-foreground">
      <SkipLink targetId="landing-main" />
      <LandingHeader headerRef={headerRef} overHero={overHero} active={active} reduce={reduce} />
      <main id="landing-main" tabIndex={-1} className="overflow-x-clip focus:outline-none">
        <LandingHero sectionRef={heroRef} ctaRef={heroCtaRef} reduce={reduce} />
        <FeaturesSection reduce={reduce} />
        <StepsSection reduce={reduce} />
        <LevelsSection reduce={reduce} />
        <OwnersSection reduce={reduce} />
        <ClosingCta ctaRef={finalCtaRef} reduce={reduce} />
      </main>
      <LandingFooter />
      <MobileActionBar show={!heroCtaVisible && !finalCtaVisible} />
    </div>
  </LazyMotion>;
}
