/**
 * Sample content for the `offer` blueprint: WellSky, invited to the same Limitless working lunch
 * as First American, rebuilt around WellSky's own problem: clinical-depth content for six care
 * settings, reviewed properly, at the scale of 20,000 care sites.
 *
 * Source: the Limitless account page for WellSky in Opal ("Limitless Account Page — WellSky
 * (Mockup v2, weighted)", account 0014J00000MyY3IQAV, September 2026) and its signal layer.
 *
 * Used, as the substance of the offer:
 *   - six care settings and 20,000 care sites; the four the page names (home health, hospice,
 *     blood banks, cell therapy labs) are the audience cards
 *   - clinical and regulatory review on every piece of content (the page's MX case) -> the
 *     review rule the session ends with
 *   - experimentation as the lead priority (the page's CX co-lead) -> "a first test to run",
 *     without ever saying why we think they want one
 *   - WellSky's own AI story (ambient listening giving clinicians time back) -> one line of the
 *     problem, without the number
 *   - WordPress disclosed -> only as "your current site stays exactly as it is"; never named
 * Never surfaced: 6QA, intent scores, buying stages, the weighting, the dual-priority band.
 * Proof: Diligent, the page's regulated-software peer. Both quotes are verbatim from
 * optimizely.com/field-notes/customer-stories/diligent-video/ (checked against the page HTML).
 * No hosts: the account has no open opportunity and no named rep ("Software Strategy Team").
 */
import { ABOUT_CTA, OPTIMIZELY_ABOUT } from './optimizely-about.mjs'

const DILIGENT = 'https://www.optimizely.com/field-notes/customer-stories/diligent-video/'

export function content(meetingUrl) {
  return {
    offerEyebrow: { Text: 'A working lunch for WellSky', HeadingLevel: 'h4' },
    offerHeadline: { Text: 'Twenty thousand care sites. ##Start with twelve.##', HeadingLevel: 'h1' },
    offerHighlights: [
      { StatValue: '45 min', Description: 'run live on your own account list, not a sandbox' },
      { StatValue: '12 accounts', Description: 'you pick them from across your care settings' },
      { StatValue: '6 settings', Description: 'one engine writing for each, at clinical depth' },
      { StatValue: 'Lunch', Description: 'on us, for everyone you bring' },
    ],
    offerIntro: {
      MainBody:
        'Bring a dozen accounts from across your care settings. Over lunch, agents write a page for each ' +
        'one at clinical depth, and your reviewers decide what would ever be allowed to publish.',
    },
    offerCta: { ButtonText: 'Book the working lunch', ButtonUrl: meetingUrl, Variant: 'primary' },
    offerSecondaryCta: ABOUT_CTA,

    ...OPTIMIZELY_ABOUT,

    problemThesis: {
      Headline: 'Six care settings. Six clinical arguments. One marketing team.',
      Body:
        'A home health agency, a hospice provider, a blood center, and a cell therapy lab each arrive with ' +
        'different evidence needs, different timelines, and a different reason to trust you. One general ' +
        'page serves none of them well.\n\n' +
        'Writing at clinical depth for one setting takes a specialist and a reviewer. Doing it for every ' +
        'account across 20,000 care sites, and for everyone inside each account who has to agree, is ' +
        'thousands of pages that a team this size cannot write by hand.\n\n' +
        'You build AI that gives clinicians their time back. This lunch is about giving the same time back ' +
        'to the people who write about it.',
    },
    problemLanes: [
      {
        Lane: 'Home health agencies',
        Need: 'Proof that visits, staffing, and compliance stay in step as they grow',
        Outcome: 'A page written for a hospital system reads as someone else’s problem.',
      },
      {
        Lane: 'Hospice providers',
        Need: 'Evidence that documentation takes less time away from patients and families',
        Outcome: 'Their argument is time and dignity, not throughput.',
      },
      {
        Lane: 'Blood centers',
        Need: 'Confidence in traceability, donor management, and the next audit',
        Outcome: 'They read for compliance first and features second.',
      },
      {
        Lane: 'Cell therapy labs',
        Need: 'A chain of custody they can defend to a regulator',
        Outcome: 'The page has to be as precise as the process it describes.',
      },
    ],

    proofHeadline: { Text: 'A regulated software team that made the same trade', HeadingLevel: 'h2' },
    proofQuote1: {
      QuoteText:
        "AI is still not a magic bullet, it's not an easy button, but it does make things easier and faster " +
        'and is opening up more creative ways of working',
      Attribution: 'John Habib, Senior Director, Content Strategy',
      CompanyName: 'Diligent · governance, risk, and compliance software',
      ResourceType: 'Customer story · video',
      ResourceUrl: DILIGENT,
    },
    proofQuote2: {
      QuoteText:
        'We brought in the CMP to centralize and fix that problem like many clients do, and it was a total ' +
        'game changer for us.',
      Attribution: 'John Habib, Senior Director, Content Strategy',
      CompanyName: 'Diligent · 65% of content team time reclaimed',
      ResourceType: 'Customer story',
      ResourceUrl: DILIGENT,
    },

    outcomesHeadline: { Text: 'What you leave lunch with', HeadingLevel: 'h2' },
    outcomesIntro: {
      MainBody: 'Three things your team can use the next morning, whatever you decide about Limitless.',
    },
    outcomes: [
      {
        Title: 'Twelve pages, drafted',
        Description:
          'One per account you brought, each written for its care setting and routed past your reviewer. ' +
          'Every block traces back to the signal behind it.',
      },
      {
        Title: 'A first test to run',
        Description:
          'Two versions of one care-setting page, set up to test against live traffic, so the next brief ' +
          'starts from evidence instead of opinion.',
      },
      {
        Title: 'A review rule your clinical team wrote',
        Description:
          'Which pages may publish on their own and which wait for clinical or regulatory sign-off, set per ' +
          'program before a single page goes anywhere.',
      },
    ],

    agendaHeadline: { Text: 'How the 45 minutes run', HeadingLevel: 'h2' },
    agendaIntro: { MainBody: 'Your list on one screen, the pages writing themselves on the other.' },
    agendaSteps: [
      {
        Title: 'Minutes 0–10: you pick the accounts',
        Description:
          'Twelve names across home health, hospice, blood, cell therapy, and the settings in between. Name the personas once.',
        MarkerColor: 'lime',
      },
      {
        Title: 'Minutes 10–30: agents write, your reviewers watch',
        Description:
          'Pages build live from the sources you approve. A clinical reviewer edits one before it finishes.',
        MarkerColor: 'aqua',
      },
      {
        Title: 'Minutes 30–45: the rule, the test, and the plan',
        Description:
          'Set what may publish unattended, pick the first test, and size the full list on your numbers.',
        MarkerColor: 'lime',
      },
    ],

    fitHeadline: { Text: 'Who this lunch is for', HeadingLevel: 'h2' },
    fitYes: {
      CalloutType: 'warning', // the green variant; the enum is info|warning|error|default
      CalloutHeading: 'A good fit if you…',
      CalloutText:
        '✓ market to more than one care setting from one team\n' +
        '✓ put clinical or regulatory review on every page\n' +
        '✓ want each setting to convert on its own evidence',
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
        Question: 'Do we have to move our website?',
        Answer: 'No. Pages publish on a subdomain in your brand, so your current site stays exactly as it is.',
      },
      {
        Question: 'Will anything go live?',
        Answer:
          'Not unless you say so. Nothing publishes until it is approved, and the rule is set per program, so ' +
          'clinical review can hold every page.',
      },
      {
        Question: 'Where does the copy come from?',
        Answer:
          'Only from sources you approve: your site, your CRM, public filings, and news. Nothing is invented, ' +
          'and every block traces back to the signal behind it.',
      },
      {
        Question: 'Who should join from our side?',
        Answer:
          'Whoever owns demand generation, a product marketer from one or two care settings, and someone who ' +
          'signs off clinical claims. Four or five people is right.',
      },
      {
        Question: 'What happens after lunch?',
        Answer:
          'You keep the twelve drafts, the test plan, and the review rule. If you want to go further, we plan a ' +
          'pilot on one care setting. If not, that is the end of it.',
      },
      {
        Question: 'Who wrote this page?',
        Answer:
          'An agent, from public signals and the same brand rules the session uses. Connect your own systems ' +
          'and the pages get considerably sharper than this one.',
      },
    ],

    offerClose: {
      Title: 'Bring twelve accounts. We’ll bring lunch.',
      Description:
        'Forty-five minutes, a page for each account at clinical depth, and a reviewer in the loop from the first draft.',
      ButtonText: 'Book the working lunch',
      ScheduleUrl: meetingUrl,
    },
  }
}

/** Page-level properties. `null` withholds a key the Northwind defaults would otherwise set. */
export const PAGE = {
  displayName: 'WellSky — working lunch offer',
  // Serialized into the page source with componentPlan: never name a signal here.
  fit: 'use-case, competitor not named',
  properties: {
    salesforceAccountID: '0014J00000MyY3IQAV',
    companySlug: 'wellsky',
    companyName: 'WellSky',
    brandDomain: 'wellsky.com',
    brandAccentColor: null,
    customerLogo: null,
    competitorName: null,
    PageTitle: 'A working lunch for WellSky — Optimizely',
    MetaDescription:
      'Forty-five minutes, twelve of your accounts across your care settings, and a page for each one at clinical depth. Lunch on us.',
  },
}
