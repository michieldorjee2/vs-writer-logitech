/**
 * Sample content for the `offer` blueprint (src/cms/blueprints/offer.ts): one account, one offer.
 *
 * The offer is a free 30-minute working session in which Optimizely rebuilds one of the account's
 * real pages live in Visual Builder. Account context appears only where it sharpens the offer —
 * the hero cards and the "is this for you" lists — never as a dossier.
 *
 * Every value is shaped as the element's own properties, keyed by the blueprint's flat key.
 * One `##run##` on the whole page, in the hero, rendered as tonal emphasis.
 */
export function offerContent(meetingUrl) {
  return {
    offerEyebrow: { Text: 'A working session for Northwind Traders', HeadingLevel: 'h4' },
    offerHeadline: { Text: 'Ship your next rewards page ##without a release##', HeadingLevel: 'h1' },
    offerHighlights: [
      { StatValue: '30 min', Description: 'one working session, on a call, with the people who own the page' },
      { StatValue: '1 page', Description: 'your real rewards landing page, rebuilt live in Visual Builder' },
      { StatValue: '3', Description: 'fixes you keep, whatever you decide about Optimizely' },
      { StatValue: '£0', Description: 'no licence, no pilot, no procurement to get started' },
    ],
    offerIntro: {
      MainBody:
        'Bring the rewards page that has been waiting on the release train. We rebuild it with you, ' +
        'in your brand, while you watch — and you leave with the page, a plan to ship it, and a ' +
        'straight answer on whether the eleven weeks can go.',
    },
    offerCta: { ButtonText: 'Book your session', ButtonUrl: meetingUrl, Variant: 'primary' },

    proofHeadline: { Text: 'Teams who took the same thirty minutes', HeadingLevel: 'h2' },
    proofQuote1: {
      QuoteText:
        'We brought the page we had been fighting for a quarter. By the end of the call it was ' +
        'built, and the only question left was why we had been shipping it through engineering.',
      Attribution: 'Head of Digital Platforms, European grocery retailer',
      CompanyName: 'Grocery retail, 900 stores',
      ResourceType: 'Customer story',
      Duration: '4 min read',
      ResourceUrl: 'https://www.optimizely.com/customers/',
    },
    proofQuote2: {
      QuoteText:
        'It was the most useful half hour of our replatforming evaluation, because it was about our ' +
        'page instead of a demo site.',
      Attribution: 'Marketing Technology Director, North American retail group',
      CompanyName: 'Retail group, 3 brands',
      ResourceType: 'Customer story',
      Duration: '6 min read',
      ResourceUrl: 'https://www.optimizely.com/customers/',
    },

    hostsHeadline: { Text: 'Who runs your session', HeadingLevel: 'h2' },
    hostsIntro: {
      MainBody:
        'Three people, one call. A solutions architect builds the page, your account executive keeps ' +
        'it honest about what it would take, and someone who has run this for other retailers says ' +
        'where it usually goes wrong.',
    },
    hosts: [
      { Initials: 'TB', Name: 'Tom Byrne', Role: 'Principal Solutions Architect — builds the page', Email: 'tom.byrne@example.com' },
      { Initials: 'SK', Name: 'Sofia Kallio', Role: 'Enterprise Account Executive, Nordics', Email: 'sofia.kallio@example.com' },
      { Initials: 'MD', Name: 'Michiel Dorjee', Role: 'Director, AI Innovation', Email: 'michiel@optimizely.com' },
    ],

    outcomesHeadline: { Text: 'What you walk away with', HeadingLevel: 'h2' },
    outcomesIntro: {
      MainBody: 'Not a deck. Three things you can use on Monday, whether or not you ever buy anything.',
    },
    outcomes: [
      { Title: 'Your page, rebuilt', Description: 'The rewards landing page, recomposed in Visual Builder from your own content and brand, yours to keep as a reference build.' },
      { Title: 'A shipping plan', Description: 'Which of your three AEM instances the page would come off first, and what it takes to publish it without a release.' },
      { Title: 'A straight answer', Description: 'Whether the eleven-week brief-to-live gap is a tooling problem, a process problem, or both — in writing, the same day.' },
    ],

    agendaHeadline: { Text: 'How the thirty minutes run', HeadingLevel: 'h2' },
    agendaIntro: { MainBody: 'Screens shared, your page on one side, Visual Builder on the other.' },
    agendaSteps: [
      { Title: 'Minutes 0–5 — the page as it is today', Description: 'You walk us through the page and what has been blocking it. We only listen.', MarkerColor: 'lime' },
      { Title: 'Minutes 5–20 — rebuilt, live', Description: 'We compose it in Visual Builder with your copy and brand, and you change it yourself before the call ends.', MarkerColor: 'aqua' },
      { Title: 'Minutes 20–30 — the plan', Description: 'What shipping it would take across your stack, and the three fixes worth making either way.', MarkerColor: 'lime' },
    ],

    fitHeadline: { Text: 'Is this for you?', HeadingLevel: 'h2' },
    fitYes: {
      CalloutType: 'warning', // the green variant (lime icon tile); the enum is info|warning|error|default
      CalloutHeading: 'A good fit if you…',
      CalloutText:
        '✓ own a campaign or rewards page that ships through a release\n' +
        '✓ can bring the page, its copy and its brand guide\n' +
        '✓ want an answer this quarter, not a roadmap',
    },
    fitNo: {
      CalloutType: 'default',
      CalloutHeading: 'Not the right half hour if you…',
      CalloutText:
        '— are looking for a general platform demo\n' +
        '— have no page in mind yet\n' +
        '— need a full RFP response (we will do that separately)',
    },

    faqHeadline: { Text: 'Questions you might have', HeadingLevel: 'h2' },
    faqs: [
      { Question: 'Is it really free?', Answer: 'Yes. No licence, no pilot agreement and no procurement. It is thirty minutes of our time, on your page.' },
      { Question: 'What do we need to bring?', Answer: 'The page — a live URL is enough — plus its copy and your brand guide if you have one to hand. Nothing needs to be exported from Adobe Experience Manager.' },
      { Question: 'Do we have to be evaluating Optimizely?', Answer: 'No. The three fixes you leave with are yours whatever you decide, and plenty of teams book this to pressure-test the tools they already have.' },
      { Question: 'Who should join from our side?', Answer: 'Whoever owns the page, and ideally whoever ships it. Two or three people is the sweet spot; more than five and it turns into a meeting.' },
      { Question: 'What happens after the call?', Answer: 'You get the rebuilt page and the written plan the same day. If you want to go further we will suggest a next step; if you do not, that is the end of it.' },
    ],

    offerClose: {
      Title: 'Bring one page. Leave with it shipped.',
      Description: 'Thirty minutes with the people who would build it. Pick a time that works for your team.',
      ButtonText: 'Book your session',
      ScheduleUrl: meetingUrl,
    },
  }
}

export const OFFER_PAGE = {
  PageTitle: 'A working session for Northwind Traders — Optimizely',
  MetaDescription: 'Thirty minutes, one rewards page rebuilt live in Visual Builder, and a plan to ship it without a release.',
}
