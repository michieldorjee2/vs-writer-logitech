/**
 * FinServPage — Brightstream financial-services landing template.
 *
 * The site is Brightstream; Aldus personalizes it 1:1 for a target:
 *   - b2b (Meridian Bank)  → "book a meeting" modal
 *   - b2c (Jordan Miller)  → multi-step savings-application modal
 *
 * Mirrors the live financial-services.optidemo.com look (Playfair + Jost,
 * navy+gold, photographic hero) and its modal interactions. Content is
 * CMS-first with per-field demo fallback. A light IntersectionObserver adds
 * scroll-reveal as progressive enhancement — the server renders everything
 * visible, so there is no hydration flash.
 */

import { useEffect, useRef, useState } from 'react';
import type { FinServPage as FinServPageType } from '../lib/graph-types';
import { getFinServDemoContent, FINSERV_BRAND, FINSERV_TAGLINE, FINSERV_NAV } from '../lib/finserv-demo-content';
import FinServHeader from './finserv/FinServHeader';
import FinServHero from './finserv/FinServHero';
import FinServScenario from './finserv/FinServScenario';
import FinServProblems from './finserv/FinServProblems';
import FinServHowItWorks from './finserv/FinServHowItWorks';
import FinServProfileCallout from './finserv/FinServProfileCallout';
import FinServFooter from './finserv/FinServFooter';
import FinServModal from './finserv/FinServModal';

interface Props {
  page: FinServPageType;
}

export default function FinServPage({ page }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    root.classList.add('js-reveal');
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-finserv-reveal]'));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    );
    targets.forEach((t) => observer.observe(t));
    requestAnimationFrame(() => {
      targets.forEach((t) => {
        if (t.getBoundingClientRect().top < window.innerHeight) {
          t.classList.add('is-visible');
          observer.unobserve(t);
        }
      });
    });
    return () => {
      observer.disconnect();
      root.classList.remove('js-reveal');
    };
  }, []);

  const slug =
    page.targetSlug ||
    (page._metadata?.url?.hierarchical || '').replace(/^\/+|\/+$/g, '').replace(/^en\//, '');
  const demo = getFinServDemoContent(slug);

  const brand = page.brand || FINSERV_BRAND;
  const tagline = page.tagline || FINSERV_TAGLINE;
  const navLinks = page.navLinks || FINSERV_NAV;
  const headerCta = page.headerCta || demo?.headerCta || null;
  const hero = page.hero || demo?.hero;
  const heroTag = page.targetName ? demo?.heroTag || 'Personalized for' : null;
  const heroImageUrl = page.heroImageUrl || demo?.heroImageUrl || null;
  const stats = page.stats || demo?.stats || null;
  const scenario = page.scenario || demo?.scenario || null;
  const problems = page.problems || demo?.problems || null;
  const howItWorks = page.howItWorks || demo?.howItWorks || null;
  const profile = page.profile || demo?.profile || null;
  const footer = page.footer || demo?.footer || null;
  const audience = page.audience || demo?.audience;
  const savings = page.savings || demo?.savings || null;
  const meeting = page.meeting || demo?.meeting || null;

  if (!hero) return null;

  const modalKind = audience === 'b2b' ? 'meeting' : 'savings';
  const openModal = () => setModalOpen(true);

  return (
    <main ref={rootRef} className={`finserv-page audience-${audience || 'b2c'}`} id="main-content">
      <a href="#main-content" className="abm-skip-link">Skip to main content</a>

      <div className="finserv-demobar">
        <strong>DEMO</strong> · Brightstream experience personalized by Optimizely Opal{page.targetName ? ` for ${page.targetName}` : ''}
      </div>

      <FinServHeader brand={brand} navLinks={navLinks} cta={headerCta} onPrimary={openModal} onLogin={openModal} />
      <FinServHero
        block={hero}
        heroTag={heroTag}
        targetName={page.targetName}
        imageUrl={heroImageUrl}
        stats={stats}
        onPrimary={openModal}
      />
      {scenario && <FinServScenario block={scenario} />}
      {problems && <FinServProblems block={problems} />}
      {howItWorks && <FinServHowItWorks block={howItWorks} anchorId="how" />}
      {profile && <FinServProfileCallout block={profile} />}
      <FinServFooter brand={brand} tagline={tagline} block={footer} />

      {modalOpen && (
        <FinServModal
          kind={modalKind}
          brand={brand}
          targetName={page.targetName}
          savings={savings}
          meeting={meeting}
          onClose={() => setModalOpen(false)}
        />
      )}
    </main>
  );
}
