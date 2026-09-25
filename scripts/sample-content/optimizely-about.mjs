/**
 * The offer blueprint's `offer-about` band: who Optimizely is, for a reader who has never heard of
 * us. The SAME on every offer page, so it lives here once rather than in each account's content.
 *
 * Wording is optimizely.com's own (homepage, read 25 September 2026): "the AI platform for
 * marketing that gives you all tools you need to create and optimize every digital experience",
 * "One platform. Three paths to growth.", "Trusted by 10,000+ brands", "work about work", and the
 * three product cards (Agentic CMS, Agentic Experimentation, Agent Platform) verbatim. Re-read the
 * homepage before reusing this after a site change.
 */
export const OPTIMIZELY_ABOUT = {
  aboutEyebrow: { Text: 'Who is Optimizely?', HeadingLevel: 'h4' },
  aboutHeadline: { Text: 'The AI platform for marketing', HeadingLevel: 'h2' },
  aboutIntro: {
    MainBody:
      'Optimizely gives you all the tools you need to create and optimize every digital experience, ' +
      'with AI agents taking on the work about work. One platform, three paths to growth, trusted by ' +
      '10,000+ brands.',
  },
  aboutPillars: [
    {
      Title: 'Agentic CMS',
      Description: 'Let your creators create. Publish faster and keep your entire site performing its best, automatically.',
    },
    {
      Title: 'Agentic Experimentation',
      Description: 'Turn traffic into revenue. Continuously test, personalize, and optimize. Then prove your impact.',
    },
    {
      Title: 'Agent Platform',
      Description: 'Put AI agents to work. Automate tasks, remove bottlenecks, and scale without adding headcount.',
    },
  ],
}

/** The hero's secondary CTA that scrolls to the band above (its section carries `anchor: about`). */
export const ABOUT_CTA = { ButtonText: 'Who is Optimizely?', ButtonUrl: '#about', Variant: 'secondary' }
