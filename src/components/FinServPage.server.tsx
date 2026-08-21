/**
 * FinServPage.server — SSR entry for the Brightstream financial-services
 * template. Renders the personalized landing surface statically (no effects,
 * no modal); the client component hydrates and wires the interactions. CMS-first
 * with per-field demo fallback.
 */

import type { FinServPage as FinServPageType } from '../lib/graph-types';
import { getFinServDemoContent, FINSERV_BRAND, FINSERV_TAGLINE, FINSERV_NAV } from '../lib/finserv-demo-content';
import FinServHeader from './finserv/FinServHeader';
import FinServHero from './finserv/FinServHero';
import FinServScenario from './finserv/FinServScenario';
import FinServProblems from './finserv/FinServProblems';
import FinServHowItWorks from './finserv/FinServHowItWorks';
import FinServProfileCallout from './finserv/FinServProfileCallout';
import FinServFooter from './finserv/FinServFooter';

interface Props {
  page: FinServPageType;
}

export default function FinServPageServer({ page }: Props) {
  const slug =
    page.targetSlug ||
    (page._metadata?.url?.hierarchical || '').replace(/^\/+|\/+$/g, '').replace(/^en\//, '');
  const demo = getFinServDemoContent(slug);

  const brand = page.brand || FINSERV_BRAND;
  const tagline = page.tagline || FINSERV_TAGLINE;
  const navLinks = page.navLinks || FINSERV_NAV;
  const headerCta = page.headerCta || demo?.headerCta || null;
  const hero = page.hero || demo?.hero;
  const heroTag = page.targetName ? (demo?.heroTag || 'Personalized for') : null;
  const heroImageUrl = page.heroImageUrl || demo?.heroImageUrl || null;
  const stats = page.stats || demo?.stats || null;
  const scenario = page.scenario || demo?.scenario || null;
  const problems = page.problems || demo?.problems || null;
  const howItWorks = page.howItWorks || demo?.howItWorks || null;
  const profile = page.profile || demo?.profile || null;
  const footer = page.footer || demo?.footer || null;
  const audience = page.audience || demo?.audience;

  if (!hero) return null;

  return (
    <main className={`finserv-page audience-${audience || 'b2c'}`} id="main-content">
      <a href="#main-content" className="abm-skip-link">Skip to main content</a>

      <div className="finserv-demobar">
        <strong>DEMO</strong> · Brightstream experience personalized by Optimizely Opal{page.targetName ? ` for ${page.targetName}` : ''}
      </div>

      <FinServHeader brand={brand} navLinks={navLinks} cta={headerCta} />
      <FinServHero
        block={hero}
        heroTag={heroTag}
        targetName={page.targetName}
        imageUrl={heroImageUrl}
        stats={stats}
      />
      {scenario && <FinServScenario block={scenario} />}
      {problems && <FinServProblems block={problems} />}
      {howItWorks && <FinServHowItWorks block={howItWorks} anchorId="how" />}
      {profile && <FinServProfileCallout block={profile} />}
      <FinServFooter brand={brand} tagline={tagline} block={footer} />
    </main>
  );
}
