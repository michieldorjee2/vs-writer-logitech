/**
 * Demo-time content for the Brightstream financial-services template.
 *
 * The *site* is Brightstream (financial-services.optidemo.com) — its logo,
 * palette and footer. Aldus applies 1:1 personalization on top of it for a
 * specific target:
 *   - meridian-bank (B2B) — Brightstream Business Banking prepared for the
 *     prospect "Meridian Bank". Goal: book a meeting.
 *   - jordan-miller (B2C) — Brightstream High-Yield Savings personalized for
 *     Jordan Miller. Goal: open the account online, without speaking to anyone.
 *
 * Mirrors the retail demo-content pattern: typed records keyed by flat slug,
 * surfaced via getFinServDemoContent(slug). Because the FinServPage content
 * type is not yet registered in the showcase CMS, synthFinServPageFromDemo()
 * builds a whole FinServPage from these records so the pages render today;
 * once the type is registered and Aldus authors into it, Graph takes over and
 * these become per-field fallback.
 */

import type {
  FinServPage,
  FinServAudience,
  FinServCTA,
  FinServHeroBlock,
  FinServScenarioBlock,
  FinServProblemsBlock,
  FinServHowItWorksBlock,
  FinServProfileBlock,
  FinServFooterBlock,
  FinServStat,
  FinServSavingsConfig,
  FinServMeetingConfig,
} from './graph-types.js';

const BRAND = 'Brightstream';
const TAGLINE = 'Banking reimagined for the modern age';

// Real Brightstream hero imagery (public CMP CDN, lifted from the live site).
const HERO_B2B = 'https://images3.cmp.optimizely.com/Zz05NTc0ZjgyNjUwNjExMWYxYmNlMzhlMjU4MTIyYTc4Mg==';
const HERO_B2C = 'https://images1.cmp.optimizely.com/Zz03YzVhN2YyMjU0NWUxMWYxODA5Y2ZlYjQ2YjQ2ZTZhMA==';

const NAV = ['Personal Banking', 'Business Banking', 'Wealth Management', 'Articles', 'About Us'];

// Shared trust badges + legal — identical for both personas.
const FOOTER: FinServFooterBlock = {
  legal:
    'Brightstream Bank, N.A. Member FDIC. Equal Housing Lender. Deposit products ' +
    'provided by Brightstream Bank, N.A. APY = Annual Percentage Yield, accurate as ' +
    'of today and subject to change. This is a demonstration experience created for ' +
    'Optimizely; figures are illustrative and not a real financial product.',
  badges: ['Member FDIC', 'Equal Housing Lender', '256-bit Encryption', 'SIPC Protected'],
};

export interface FinServDemo {
  audience: FinServAudience;
  targetName: string;
  heroTag: string;
  heroImageUrl: string;
  PageTitle: string;
  MetaDescription: string;
  headerCta: FinServCTA;
  hero: FinServHeroBlock;
  stats: FinServStat[];
  scenario: FinServScenarioBlock;
  problems: FinServProblemsBlock;
  howItWorks: FinServHowItWorksBlock;
  profile: FinServProfileBlock;
  footer: FinServFooterBlock;
  savings?: FinServSavingsConfig;
  meeting?: FinServMeetingConfig;
}

// ---------------------------------------------------------------------------
// B2B — Brightstream prepared for prospect Meridian Bank. Goal: book a meeting.
// ---------------------------------------------------------------------------

const MERIDIAN: FinServDemo = {
  audience: 'b2b',
  targetName: 'Meridian Bank',
  heroTag: 'Prepared for',
  heroImageUrl: HERO_B2B,
  PageTitle: 'Brightstream for Meridian Bank — Banking-as-a-Service, ready to launch',
  MetaDescription:
    'Brightstream gives Meridian Bank a modern banking platform without the rebuild: ' +
    'embedded accounts, real-time payments and a dedicated partnership team. Book a meeting.',
  headerCta: { label: 'Book a meeting', href: '#book' },
  hero: {
    eyebrow: 'A proposal for Meridian Bank',
    headline: 'Give Meridian Bank a modern core — without the five-year rebuild.',
    subhead:
      'Your members expect instant payments, embedded accounts and a mobile experience ' +
      'that rivals the neobanks. Brightstream provides the platform underneath, so Meridian ' +
      'keeps the relationship and we carry the engineering.',
    cta: {
      label: 'Book a meeting',
      href: '#book',
      note: 'A 30-minute working session — we come with your numbers already pulled.',
    },
    highlights: ['Embedded accounts & cards', 'Real-time payments', 'Go live in one quarter'],
  },
  stats: [
    { value: '320+', label: 'Institutions powered' },
    { value: '$45B', label: 'Deposits on platform' },
    { value: '99.99%', label: 'Platform uptime' },
  ],
  scenario: {
    label: 'The pattern we see',
    title: 'Regional banks like Meridian are being out-shipped, not out-banked.',
    paragraphs: [
      'Meridian Bank has the trust, the deposits and the community relationships that took ' +
        'decades to build. What it does not have is a six-month path to instant payments, or a ' +
        'mobile app that a 28-year-old will choose over a neobank. The core vendor quotes ' +
        'eighteen months and seven figures for each new feature.',
      'We have watched this exact squeeze play out across hundreds of institutions. The winners ' +
        'did not rip out their core — they layered a modern platform on top of it. Brightstream ' +
        'is that layer: embedded accounts, cards and real-time payments that go live in a quarter, ' +
        'with Meridian’s brand on the front and our engineering underneath.',
    ],
    pullLine: 'Keep the relationship. Let us carry the roadmap.',
  },
  problems: {
    label: 'Where it bites',
    heading: 'Three gaps slowing Meridian Bank down',
    items: [
      {
        stat: '18 mo',
        title: 'Core changes crawl',
        description:
          'Every new product waits in the core vendor’s queue. Competitors ship the same ' +
          'feature in a sprint while Meridian waits for a release window.',
      },
      {
        stat: '0.01%',
        title: 'Deposits walk to neobanks',
        description:
          'Younger members move their direct deposit to apps paying real yield and offering ' +
          'instant transfers. Each one that leaves is a relationship that does not come back.',
      },
      {
        stat: '7 figures',
        title: 'Build-it-yourself is a trap',
        description:
          'Standing up payments, KYC and ledgering in-house means a multi-year program and a ' +
          'team you have to hire, before a single member benefits.',
      },
    ],
  },
  howItWorks: {
    label: 'How a partnership works',
    heading: 'From first call to live product in one quarter',
    steps: [
      {
        title: 'A working session, not a pitch',
        description:
          'Thirty minutes with our platform team, who have already reviewed Meridian’s public ' +
          'filings. We map the gaps and show exactly what each one is costing in lost deposits.',
      },
      {
        title: 'Connect, don’t rebuild',
        description:
          'Brightstream layers onto your existing core through one integration. Your ledger ' +
          'stays the system of record; we add the modern rails on top.',
      },
      {
        title: 'Launch under Meridian’s brand',
        description:
          'Embedded accounts, cards and real-time payments go live in your app, your colors, ' +
          'your name — backed by a dedicated partnership team, not a ticket queue.',
      },
    ],
  },
  profile: {
    initials: 'DO',
    attribution: 'David Okafor',
    role: 'Chief Operating Officer',
    company: 'Lakeside Community Bank',
    quote:
      'We went live on Brightstream in a single quarter. Our members got instant payments and a ' +
      'savings rate that finally competes — and we never had to touch our core ledger or grow the team.',
  },
  footer: FOOTER,
  meeting: {
    contactName: '',
    company: 'Meridian Bank',
    slots: ['Tue 10:00', 'Wed 14:30', 'Thu 09:00', 'Fri 11:00'],
  },
};

// ---------------------------------------------------------------------------
// B2C — Brightstream personalized for Jordan Miller. Goal: open a HYSA online.
// ---------------------------------------------------------------------------

const JORDAN: FinServDemo = {
  audience: 'b2c',
  targetName: 'Jordan Miller',
  heroTag: 'Welcome',
  heroImageUrl: HERO_B2C,
  PageTitle: 'Brightstream — Open your High-Yield Savings, Jordan',
  MetaDescription:
    'Earn 4.50% APY with no minimums and no fees. Open a Brightstream High-Yield Savings ' +
    'Account online in about three minutes — no phone call, no branch visit.',
  headerCta: { label: 'Open an account', href: '#open' },
  hero: {
    eyebrow: 'Welcome back, Jordan',
    headline: 'Your savings could be earning <em>4.50%</em>. Today it earns almost nothing.',
    subhead:
      'The average savings account pays 0.42%. Brightstream High-Yield Savings pays 4.50% APY ' +
      'with no minimums and no monthly fees. Open it from your couch in about three minutes — ' +
      'no phone call, no branch, no salesperson.',
    cta: {
      label: 'Open your High-Yield Savings',
      href: '#open',
      note: 'Fully online. You will not have to speak to anyone.',
    },
    highlights: ['4.50% APY', 'No minimum balance', '$0 monthly fees'],
  },
  stats: [
    { value: '4.50%', label: 'APY, no minimums' },
    { value: '~3 min', label: 'To open online' },
    { value: '2M+', label: 'Customers' },
  ],
  scenario: {
    label: 'For you, Jordan',
    title: 'Most people lose money on their savings without ever noticing.',
    paragraphs: [
      'You did the responsible thing — you built a cushion and left it in savings. The catch is ' +
        'that the big banks quietly pay you almost nothing for it. A $15,000 balance at 0.42% ' +
        'earns about $63 a year. The same balance at Brightstream earns $675.',
      'It is not that you did anything wrong. Switching simply felt like a hassle — forms, a phone ' +
        'call, a branch visit during work hours. So Brightstream removed all of it. Opening an ' +
        'account is a few taps, your money keeps earning the moment it lands, and you will never ' +
        'have to talk to anyone to do it.',
    ],
    pullLine: 'Same money. Same safety. Roughly ten times the interest.',
  },
  problems: {
    label: 'Why it matters',
    heading: 'Three reasons your money is working too hard for too little',
    items: [
      {
        stat: '0.42%',
        title: 'The big banks pay almost nothing',
        description:
          'The national average savings rate is a fraction of a percent. Your balance is helping ' +
          'the bank earn — not you.',
      },
      {
        stat: '$15+',
        title: 'Fees quietly eat your balance',
        description:
          'Maintenance fees, minimum-balance penalties and transfer charges add up over a year. ' +
          'Brightstream High-Yield Savings has none of them.',
      },
      {
        stat: '~30 min',
        title: 'Switching felt like a chore',
        description:
          'Branch hours, paperwork and a phone call were enough to put it off for another year. ' +
          'That delay is the most expensive part.',
      },
    ],
  },
  howItWorks: {
    label: 'How it works',
    heading: 'Open it online in about three minutes',
    steps: [
      {
        title: 'Tell us a little about you',
        description:
          'Name, address and a few details to verify your identity — the basics any account ' +
          'needs. No income docs, no credit pull.',
      },
      {
        title: 'Link your current bank',
        description:
          'Securely connect an existing account to move your first deposit. Bank-grade ' +
          'encryption; we never see your login.',
      },
      {
        title: 'Start earning 4.50% today',
        description:
          'Your account is live the moment you finish. Interest accrues immediately, and you can ' +
          'move money in or out anytime — no lockups, no penalties.',
      },
    ],
  },
  profile: {
    initials: 'PN',
    attribution: 'Priya Nair',
    role: 'Brightstream customer',
    company: 'Denver, CO',
    quote:
      'I moved my emergency fund over on a Sunday afternoon — no phone call, no branch visit. It’s ' +
      'earning more in a month than my old bank paid me all year.',
  },
  footer: FOOTER,
  savings: {
    defaultDeposit: '15000',
    products: [
      { id: 'hysa', name: 'High-Yield Savings', apy: '4.50%', benefit: 'No minimums, no monthly fees, withdraw anytime.' },
      { id: 'premium', name: 'Premium Savings', apy: '4.75%', benefit: 'Our best rate for balances over $25,000.' },
      { id: 'cd12', name: '12-Month CD', apy: '5.00%', benefit: 'Lock todayʼs rate for twelve months.' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Registry + lookups
// ---------------------------------------------------------------------------

export const FINSERV_DEMO: Record<string, FinServDemo> = {
  'meridian-bank': MERIDIAN,
  'jordan-miller': JORDAN,
  // Back-compat with the earlier slugs used before the Brightstream reframe.
  'meridian-carlos-freeman': MERIDIAN,
  'meridian-jordan-miller': JORDAN,
};

/** Strip locale prefix + slashes so "/en/jordan-miller/" matches. */
function normalizeSlug(slug: string | null | undefined): string {
  if (!slug) return '';
  return slug.replace(/^\/+|\/+$/g, '').replace(/^en(-[a-z]{2})?\//i, '');
}

export function getFinServDemoContent(slug: string | null | undefined): FinServDemo | null {
  return FINSERV_DEMO[normalizeSlug(slug)] || null;
}

export function isFinServDemoSlug(slug: string | null | undefined): boolean {
  return !!FINSERV_DEMO[normalizeSlug(slug)];
}

/**
 * Build a fully-formed FinServPage from a demo record. Used by the SSR handler
 * and /api/content when Graph returns nothing for a known FS slug, so the demo
 * renders before the CMS content type exists. Once Graph has the page, real
 * content wins and this is never reached.
 */
export function synthFinServPageFromDemo(slug: string | null | undefined): FinServPage | null {
  const demo = getFinServDemoContent(slug);
  if (!demo) return null;
  const cleanSlug = normalizeSlug(slug);
  return {
    _metadata: {
      key: `demo-${cleanSlug}`,
      url: { default: `/${cleanSlug}/`, hierarchical: `/en/${cleanSlug}/` },
      published: null,
    },
    template: 'finserv',
    PageTitle: demo.PageTitle,
    MetaDescription: demo.MetaDescription,
    brand: BRAND,
    tagline: TAGLINE,
    audience: demo.audience,
    targetSlug: cleanSlug,
    targetName: demo.targetName,
    headerCta: demo.headerCta,
    navLinks: NAV,
    heroImageUrl: demo.heroImageUrl,
    stats: demo.stats,
    savings: demo.savings || null,
    meeting: demo.meeting || null,
    hero: demo.hero,
    scenario: demo.scenario,
    problems: demo.problems,
    howItWorks: demo.howItWorks,
    profile: demo.profile,
    footer: demo.footer,
    generatedBy: 'demo-content',
  };
}

export { BRAND as FINSERV_BRAND, TAGLINE as FINSERV_TAGLINE, NAV as FINSERV_NAV };
