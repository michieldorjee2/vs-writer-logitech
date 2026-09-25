/**
 * Sample content for the `offer` blueprint: First American, invited to a working lunch where
 * Limitless writes pages for a dozen of their own accounts, live.
 *
 * Source: the First American 1:1 page and its personalization de-brief (account
 * 001Pz00000f1waEIAQ, pulled 22 September 2026). That page argues for Limitless; this one sells
 * the session it ends on ("45 minutes, your account list, and lunch on us"), and leads with the
 * problem it solves: 1:1 content does not scale with the team First American has.
 *
 * The de-brief's rules, kept:
 *   - Used, as the substance of the offer rather than as proof we did our homework: the four
 *     audiences (lenders, title agents, enterprise buyers, home warranty customers), the digital
 *     protection story (title monitoring, extended September 2026), and the new revenue seat
 *     (a CRO accountable for growth across every channel, not named).
 *   - The 1,200 x 5 = 6,000 estimate is ours, so it is labelled as ours wherever it appears and
 *     never stated as a fact about their list.
 *   - Never surfaced: the Sitecore segment (no tech-stack confirmation), 6QA buying stage, CMS
 *     migration intent, the dividend, the $6B revenue and the account tier.
 *   - No hosts and no proof quotes: the source names no people (no AE on record) and quotes no
 *     customers, so those bands are withheld rather than invented.
 *
 * One `##run##` on the page, in the hero. No em dashes in body copy (house style).
 */
export function content(meetingUrl) {
  return {
    offerEyebrow: { Text: 'A working lunch for First American', HeadingLevel: 'h4' },
    offerHeadline: { Text: 'Your Tier 1 list needs thousands of pages. ##Start with twelve.##', HeadingLevel: 'h1' },
    offerHighlights: [
      { StatValue: '45 min', Description: 'run live on your own account list, not a sandbox' },
      { StatValue: '12 accounts', Description: 'you pick them from your lender, title agent, and enterprise lists' },
      { StatValue: '4 audiences', Description: 'one engine writing for each, in your brand and your legal lines' },
      { StatValue: 'Lunch', Description: 'on us, for everyone you bring' },
    ],
    offerIntro: {
      MainBody:
        'Bring a dozen accounts from the lists you already work. Over lunch, agents write a page for each ' +
        'one while your team watches, edits, and decides what would ever be allowed to publish.',
    },
    offerCta: { ButtonText: 'Book the working lunch', ButtonUrl: meetingUrl, Variant: 'primary' },

    problemThesis: {
      Headline: 'One trust story. Four audiences who hear it differently.',
      Body:
        'Title monitoring, fraud caught before funding, a closing that goes the way it should. It is one ' +
        'promise, and every audience you serve needs it argued in its own terms.\n\n' +
        'Writing that well for one audience takes a team a week. Across a Tier 1 list of 1,200 accounts, ' +
        'with five people to convince inside each, it is roughly 6,000 pages. That is our estimate, and ' +
        'the session runs the math on your real list.\n\n' +
        'The story does not sit still either. A new state, a new product, a deal that moves a stage: each ' +
        'one changes what every page should say, and the growth target now spans every channel you sell through.',
    },
    problemLanes: [
      {
        Lane: 'Regional lenders',
        Need: 'Proof that clean closings hold at a thousand files a month',
        Outcome: 'A page written for homebuyers reads as marketing to a lender.',
      },
      {
        Lane: 'Title agents',
        Need: 'Something to hand a nervous client the week before closing',
        Outcome: 'They need it in plain words, not in a lender’s terms.',
      },
      {
        Lane: 'Enterprise buyers',
        Need: 'A case that marketing, IT, compliance, and revenue can all sign',
        Outcome: 'Five seats at the table means five arguments on one page.',
      },
      {
        Lane: 'Home warranty customers',
        Need: 'A reason to trust the same name again, years after closing',
        Outcome: 'Their moment is the renewal, not the transaction.',
      },
    ],

    outcomesHeadline: { Text: 'What you leave lunch with', HeadingLevel: 'h2' },
    outcomesIntro: {
      MainBody: 'Three things your team can use the next morning, whatever you decide about Limitless.',
    },
    outcomes: [
      {
        Title: 'Twelve pages, drafted',
        Description:
          'One per account you brought, each telling your title monitoring story in that account’s terms. ' +
          'Every block traces back to the signal behind it.',
      },
      {
        Title: 'A coverage plan',
        Description:
          'What it takes to cover the whole Tier 1 list, every persona inside every account, with the team ' +
          'you have now and no net-new headcount.',
      },
      {
        Title: 'A review rule your compliance lead wrote',
        Description:
          'Which programs may publish on their own and which hold for sign-off, set per program before a ' +
          'single page goes anywhere.',
      },
    ],

    agendaHeadline: { Text: 'How the 45 minutes run', HeadingLevel: 'h2' },
    agendaIntro: { MainBody: 'Your list on one screen, the pages writing themselves on the other.' },
    agendaSteps: [
      {
        Title: 'Minutes 0–10: you pick the accounts',
        Description:
          'Twelve names across lenders, title agencies, and enterprise buyers. Name the personas once. That is the whole brief.',
        MarkerColor: 'lime',
      },
      {
        Title: 'Minutes 10–30: agents write, you watch',
        Description:
          'Pages build live from the sources you approve. Your team rewrites one of them before it finishes.',
        MarkerColor: 'aqua',
      },
      {
        Title: 'Minutes 30–45: the rule and the plan',
        Description:
          'Compliance sets what may publish unattended. Then we size the full list together, on your numbers.',
        MarkerColor: 'lime',
      },
    ],

    fitHeadline: { Text: 'Who this lunch is for', HeadingLevel: 'h2' },
    fitYes: {
      CalloutType: 'warning', // the green variant; the enum is info|warning|error|default
      CalloutHeading: 'A good fit if you…',
      CalloutText:
        '✓ market to lenders, agents, and buyers from one team\n' +
        '✓ have a target list longer than your content calendar\n' +
        '✓ need compliance in the loop without it becoming the queue',
    },
    fitNo: {
      CalloutType: 'default',
      CalloutHeading: 'Not the right lunch if you…',
      CalloutText:
        '– want a general platform demo\n' +
        '– cannot bring real account names yet\n' +
        '– need a full RFP response, which we run separately',
    },

    faqHeadline: { Text: 'Questions you might have', HeadingLevel: 'h2' },
    faqs: [
      {
        Question: 'Do we have to connect our CRM?',
        Answer:
          'No. Twelve account names in a spreadsheet is enough to start. The agents read only the sources ' +
          'you approve, and you choose those before we begin.',
      },
      {
        Question: 'Will anything go live?',
        Answer:
          'Not unless you say so. Nothing publishes until you approve it, and the rule is set per program, ' +
          'so compliance can hold every page for review.',
      },
      {
        Question: 'Where does the copy come from?',
        Answer:
          'Only from sources you approve: your site, your CRM, public filings, and news. Nothing is invented, ' +
          'and every block on every page traces back to the signal behind it.',
      },
      {
        Question: 'Who should join from our side?',
        Answer:
          'Whoever owns the target list, someone from compliance, and whoever answers for revenue across ' +
          'channels. Four or five people is right, and lunch covers all of them.',
      },
      {
        Question: 'What happens after lunch?',
        Answer:
          'You keep the twelve drafts and the coverage plan. If you want the full list covered, we plan a ' +
          'pilot on one program. If not, that is the end of it.',
      },
      {
        Question: 'Who wrote this page?',
        Answer:
          'An agent, from public signals and the same brand rules the session uses. Connect your own systems ' +
          'and the pages get considerably sharper than this one.',
      },
    ],

    offerClose: {
      Title: 'Bring the list. We’ll bring lunch.',
      Description: 'Forty-five minutes, twelve of your accounts, and a page written for each one while you watch.',
      ButtonText: 'Book the working lunch',
      ScheduleUrl: meetingUrl,
    },
  }
}

/** Page-level properties. `null` withholds a key the Northwind defaults would otherwise set. */
export const PAGE = {
  displayName: 'First American — working lunch offer',
  fit: 'use-case, competitor unconfirmed',
  properties: {
    salesforceAccountID: '001Pz00000f1waEIAQ',
    companySlug: 'first-american',
    companyName: 'First American',
    brandDomain: 'firstam.com',
    brandAccentColor: null,
    customerLogo: null,
    // The Sitecore segment is unconfirmed (cms_techs__c is null): never name a competitor.
    competitorName: null,
    PageTitle: 'A working lunch for First American — Optimizely',
    MetaDescription:
      'Forty-five minutes, twelve of your accounts, and a page written for each one while you watch. Lunch on us.',
  },
}
