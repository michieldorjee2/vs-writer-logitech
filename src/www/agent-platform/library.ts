/**
 * The agent platform template's fixed content: everything that is the same on every page, or
 * that is chosen from a fixed set (the five use-case themes, the lifecycle states, the proof
 * library). Source: Laura Perez Riau's template debrief, 27 October 2026 (Mark artifact
 * "limitless-agent-platform-template-debrief-for-michiel.md"), its shell, and the Tyler
 * Technologies reference build. Copy is taken from those verbatim wherever it is generic.
 *
 * Nothing here is about a specific account. Account content comes from ./content.ts.
 */

export const IDENTITY_SENTENCE = 'Optimizely is the AI platform to create, manage and optimize digital experiences.'

/* ------------------------------------------------------------- lifecycle */

export type LifecycleState = 'prospect' | 'open-opp' | 'evaluated' | 'customer' | 'ex-customer'

export interface StateCopy {
  label: string
  /** Hero backdrop, per Laura's state table. */
  look: 'darkfir' | 'neutral2' | 'neutral3' | 'ltblue'
  /** H1. `##run##` is the one extruded phrase (brand: positive word, no end punctuation inside). */
  h1: string
  /** The sentence after the identity sentence. {account}, {lead} are filled in. */
  sub: string
  closeHeading: string
  closeLine: string
  primaryCta: string
  secondaryCta: { label: string; href: string }
  /** Named AE allowed on the page (open opp, customer). Otherwise the team pod. */
  namedRep: boolean
  /** Proof track: B = verified stories, A = educational assets with no logos. */
  proofTrack: 'A' | 'B'
}

const EXPLORE = { label: 'Explore the agent platform', href: 'https://www.optimizely.com/ai/' }

export const STATES: Record<LifecycleState, StateCopy> = {
  prospect: {
    label: 'Prospect',
    look: 'darkfir',
    h1: 'Your stack holds the answers. Agents ##put them to work##.',
    sub: 'Our agent platform sits on top of the tools {account} already runs, learns how your business works, and starts with {lead}.',
    closeHeading: 'Why we put this together for {account}',
    closeLine: 'See it running on your stack.',
    primaryCta: 'Arrange a session',
    secondaryCta: EXPLORE,
    namedRep: false,
    proofTrack: 'A',
  },
  'open-opp': {
    label: 'Prospect with an open opportunity',
    look: 'darkfir',
    h1: 'Everything your evaluation team needs, ##in one place##.',
    sub: 'This page sets out what our agent platform does for {account}, starting with {lead}, so everyone joining the conversation starts from the same picture.',
    closeHeading: 'Where the conversation goes from here',
    closeLine: "Bring the team. We'll bring the plan.",
    primaryCta: 'Arrange a session',
    secondaryCta: EXPLORE,
    namedRep: true,
    proofTrack: 'B',
  },
  evaluated: {
    label: 'Previously evaluated',
    look: 'neutral2',
    h1: "You looked at us before. It's a ##different platform## now.",
    sub: "Now with agents that work across the tools {account} already runs. Here's what that means for {lead}.",
    closeHeading: 'Worth a second look',
    closeLine: 'Thirty minutes. A different platform.',
    primaryCta: 'See the new platform',
    secondaryCta: EXPLORE,
    namedRep: false,
    proofTrack: 'B',
  },
  customer: {
    label: 'Customer',
    look: 'neutral3',
    h1: 'You already run Optimizely. Now put ##agents to work## on it.',
    sub: "The agent platform connects what {account} runs today to the rest of your stack and takes on {lead}, using the brand rules, data and workflows you've already set up.",
    closeHeading: "What's next for {account} on Optimizely",
    closeLine: 'Your next use case is already connected.',
    primaryCta: 'Map your next use case',
    secondaryCta: { label: 'See the agent platform roadmap', href: 'https://www.optimizely.com/ai/' },
    namedRep: true,
    proofTrack: 'B',
  },
  'ex-customer': {
    label: 'Ex-customer',
    look: 'ltblue',
    h1: 'A lot has changed since we ##last worked together##.',
    sub: "Now with an agent platform that works across whatever {account} runs today. Here's where it would start: {lead}.",
    closeHeading: "See what's changed, on your terms",
    closeLine: "Come see what's new.",
    primaryCta: "See what's changed",
    secondaryCta: EXPLORE,
    namedRep: false,
    proofTrack: 'B',
  },
}

/* ----------------------------------------------------------- who we are */

export const WHO_WE_ARE = {
  heading: 'One platform to create, optimize and run digital experiences with AI agents.',
  tiles: [
    { icon: 'edit_document', title: 'Create', body: 'Content, campaigns and pages, managed in one place.' },
    { icon: 'science', title: 'Optimize', body: 'Test and personalize every experience, tied to results.' },
    { icon: 'bolt', title: 'Run with agents', body: 'Agents that plan, build and report across Optimizely and the tools you already use.', lead: true },
  ],
  analysts: [
    { badge: 'Specialist', name: 'Gartner Emerging Market Quadrant, AI Agents for Marketing 2026', href: 'https://www.optimizely.com/field-notes/guides/gartner-emerging-market-quadrant-for-AI-agents-for-marketing' },
    { badge: 'Leader', name: 'Forrester Wave, Experience Optimization Q3 2026', href: 'https://www.optimizely.com/company/press/forrester-eos-wave-2026/' },
    { badge: 'Leader', name: 'Gartner MQ, Personalization Engines 2026', href: 'https://www.optimizely.com/company/press/personalization-engines-mq-2026/' },
  ],
  usage: { text: 'Nearly 1,700 companies have built 4,000+ agents on the platform.', source: 'Optimizely, May 2026', href: 'https://www.optimizely.com/company/press/agentic-momentum' },
}

/* ------------------------------------------------------- the five themes */

export type ThemeId = 'content-ops' | 'personalization' | 'geo' | 'optimization' | 'analytics'

export interface Theme {
  id: ThemeId
  name: string
  /** How the hero names it: "starts with {lead}". */
  lead: string
  icon: string
  /** Generic job line for the card. Mark writes an account-specific one ("in their language"). */
  job: string
  body: string
  measuredOn: string
  enabledBy: string
  /** One line in the strip of three. */
  strip: { title: string; body: string }
  /** The leadership question for "Speaks your language" when this theme leads. {account} filled in. */
  question: string
  checks: [string, string, string]
  /** Illustrative "agents at work" tasks: three done, one in progress. */
  tasks: [string, string, string, string]
  /** The close's reason line when this theme is one of the two leads. */
  reason: string
}

export const THEMES: Record<ThemeId, Theme> = {
  'content-ops': {
    id: 'content-ops',
    name: 'Content operations',
    lead: 'content operations at scale',
    icon: 'conveyor_belt',
    job: 'One content engine for every market, product and buyer',
    body: 'Agents turn a brief into on-brand drafts for each audience, check them against your brand and compliance rules, and route them for approval.',
    measuredOn: 'time from brief to published · assets per campaign',
    enabledBy: 'Optimizely Agent Platform · Virtual Teammates',
    strip: { title: 'Launch every campaign everywhere at once', body: 'Briefs to on-brand drafts for every market, with approvals built in.' },
    question: 'Which {account} campaigns are behind plan, and what should we brief first?',
    checks: ['Ranks campaigns by gap to plan', 'Explains why, in your own terms', 'Drafts the next brief, ready for approval'],
    tasks: ['Brief drafted for the next campaign', 'Copy checked against brand and compliance rules', 'Weekly content report ready for sales', 'Building the next round of audience variants'],
    reason: 'One content engine for every market and buyer, with approvals built in.',
  },
  personalization: {
    id: 'personalization',
    name: 'Personalization',
    lead: 'personalization at scale',
    icon: 'person_search',
    job: 'The right experience in front of every kind of buyer',
    body: 'Agents turn customer data into segments, then test and tailor what each visitor sees.',
    measuredOn: 'conversion by segment · qualified visits per campaign',
    enabledBy: 'Optimizely Agent Platform · Agentic Experimentation',
    strip: { title: 'The right message for every visitor', body: 'Segments from your customer data, tailored and tested.' },
    question: 'Which {account} audiences are we underserving, and what should they see instead?',
    checks: ['Finds the segments that convert below plan', 'Explains what each one is missing', 'Drafts the variant, ready to test'],
    tasks: ['Audience built from your customer data', 'Homepage variant drafted for a key segment', 'Results summarized for the team', 'Setting up the next personalization test'],
    reason: 'The right experience in front of every buyer, tested before it rolls out.',
  },
  geo: {
    id: 'geo',
    name: 'AI search and GEO',
    lead: 'getting found in AI search',
    icon: 'travel_explore',
    job: 'Be the answer when your buyers ask AI',
    body: 'Agents find where you are missing from AI answers, rewrite the pages that should be cited, and track how visibility changes.',
    measuredOn: 'AI answer share · cited pages',
    enabledBy: 'Optimizely Agent Visibility · Agent-ready Experiences',
    strip: { title: 'Be the answer when buyers ask AI', body: 'Get found and cited in AI search.' },
    question: 'Where is {account} missing from AI answers, and which pages should we fix first?',
    checks: ['Finds the questions where you are not cited', 'Shows which pages should answer them', 'Drafts the rewrite, ready for review'],
    tasks: ['AI answer visibility checked for key topics', 'Pages to update ranked by impact', 'Rewrite drafted for review', 'Tracking citations week over week'],
    reason: 'Found and cited when your buyers ask AI.',
  },
  optimization: {
    id: 'optimization',
    name: 'Experience optimization',
    lead: 'always-on experimentation',
    icon: 'speed',
    job: 'Test every page, always',
    body: 'Agents propose tests from what your data shows, build the variants and report what won, so the site keeps improving.',
    measuredOn: 'tests run per month · conversion lift',
    enabledBy: 'Optimizely Agentic Experimentation',
    strip: { title: 'Test every page, always', body: 'Always-on tests across your site.' },
    question: 'Which {account} pages are leaking conversions, and what should we test next?',
    checks: ['Ranks pages by conversion gap', 'Explains what is likely holding them back', 'Builds the test, ready to launch'],
    tasks: ['Test ideas ranked for the homepage', 'Variant built for review', 'Last test summarized for the team', 'Launching the next test'],
    reason: 'Every page tested and improving, without a backlog.',
  },
  analytics: {
    id: 'analytics',
    name: 'Analytics and insights',
    lead: 'one view of what is working',
    icon: 'insights',
    job: 'One view of what is working',
    body: 'Agents read analytics, customer data and campaigns together and answer the questions leadership asks.',
    measuredOn: 'time to answer · decisions per report',
    enabledBy: 'Optimizely Agent Platform · Optimizely Analytics',
    strip: { title: 'One view of what is working', body: 'Analytics, customer data and campaigns, read together.' },
    question: 'What moved {account} pipeline this quarter, and where should we put the next dollar?',
    checks: ['Reads across your analytics and customer data', 'Explains the change in plain terms', 'Recommends the next step, with the numbers'],
    tasks: ['Weekly performance summary ready', 'Anomaly flagged in campaign results', 'Board-ready view of what worked', 'Answering the next leadership question'],
    reason: 'One view of what is working, across every tool you run.',
  },
}

/** Tie-break order (Laura: a tie goes to content operations). */
export const THEME_ORDER: ThemeId[] = ['content-ops', 'personalization', 'geo', 'optimization', 'analytics']

export const USE_CASES_CLOSING_LINE = 'Run separately, these are five projects. On one platform, what one agent learns the next one uses.'

/* ---------------------------------------------------------------- proof */

/** Track B: verified agent platform results (Laura's Tyler build read each figure on the story page). */
export const PROOF_STORIES = [
  {
    metric: '65%',
    label: 'of team time reclaimed',
    customer: 'Diligent',
    useCase: 'B2B software content team',
    detail: 'A seven-person team serves many regions, audiences and products with nearly 100 custom instructions.',
    href: 'https://www.optimizely.com/field-notes/customer-stories/diligent-video/',
  },
  {
    metric: '10x',
    label: 'faster on-brand variant production',
    customer: 'Corinthia Hotels',
    useCase: 'persona content at scale',
    detail: 'Seven agents cover five personas across 14 journey stages, and a quality-control agent checks every output.',
    href: 'https://www.optimizely.com/field-notes/customer-stories/corinthia-hotels/',
  },
  {
    metric: 'Days → secs',
    label: 'for a competitor analysis',
    customer: 'Robinson Club',
    useCase: 'experimentation',
    detail: 'Landing pages and competitor benchmarks that took one to two days now take seconds, inside the platform the team already works in.',
    href: 'https://www.optimizely.com/field-notes/customer-stories/robinson-club-2025/',
  },
]

/** Track A: educational assets, no logos (prospect with no opportunity). */
export const PROOF_ASSETS = [
  { kind: 'Report', title: 'Gartner Emerging Market Quadrant: AI Agents for Marketing', href: WHO_WE_ARE.analysts[0].href },
  { kind: 'Overview', title: 'What the Optimizely agent platform does', href: 'https://www.optimizely.com/ai/' },
  { kind: 'Guide', title: 'How agents stay inside your guardrails', href: 'https://www.optimizely.com/trust-center/' },
]

/* ------------------------------------------------------------- 90 days */

export const FIRST_90_DAYS = [
  { step: 'Connect', body: 'Link {stack}. Nothing gets replaced.', role: 'Technology and architecture' },
  { step: 'Teach', body: 'Load brand and compliance rules, products and audiences into one shared context.', role: 'Marketing and content' },
  { step: 'Launch', body: 'Put agents on a real campaign brief, with your team approving every output.', role: 'Marketing operations and data' },
  { step: 'Scale', body: 'Add the next use case on the same context. Each one gets smarter.', role: 'AI and automation' },
]
export const GOVERNANCE_LINE = 'Governance built in: agents work inside your guardrails, every action is logged, and nothing goes live without approval.'
export const TRUST_CENTER = 'https://www.optimizely.com/trust-center/'

/* --------------------------------------------------------------- teams */

/** Industry default when fewer than three role groups resolve from the account's people. */
export const DEFAULT_TEAMS = ['Marketing leadership', 'Content and brand', 'Digital experience', 'Marketing operations and data', 'Technology and architecture']

export const PLATFORM_LAYER = [
  { icon: 'psychology', label: 'Context' },
  { icon: 'smart_toy', label: 'Agents' },
  { icon: 'account_tree', label: 'Workflows' },
  { icon: 'verified_user', label: 'Governance' },
]
