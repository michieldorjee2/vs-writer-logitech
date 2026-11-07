import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isFinServDemoSlug, synthFinServPageFromDemo } from '../src/lib/finserv-demo-content.js';
import { EXPERIENCE_QUERIES, normalizeExperienceItem } from '../src/lib/experience-queries.js';
import { graphItems } from '../src/lib/graph-envelope.js';
import { ACCOUNT_PAGE_QUERY } from '../src/lib/account-page-query.js';
import { PERSON_PAGE_QUERY } from '../src/lib/person-page-query.js';
import { publicPersonPage } from '../src/www/person-content.js';
import type { CompetitorComparisonPage, FinServPage, PersonPage, RetailCustomerPage } from '../src/lib/graph-types.js';
import { signupCacheControl, withOfferSignup } from './_lib/offer-signup.js';
import { withParentAccount } from './_lib/parent-account.js';
import { withPageCopy } from './_lib/page-copy.js';
import { graphOp, postGraphRead } from './_lib/graph-read.js';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

// FinServPage (Brightstream). The content type + instances exist in the
// showcase CMS; until Optimizely Graph finishes propagating the schema, a query
// against the not-yet-synced type returns { errors, data:null } (HTTP 200), so
// the items check below simply skips and we fall back to demo synthesis. Fields
// mirror the registered FinServPage type exactly.
const FINSERV_PAGE_QUERY = `
query GetFinServPage($slug: String!) {
  FinServPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key url { default hierarchical } published lastModified }
      template
      PageTitle MetaDescription
      brand tagline audience targetSlug targetName
      heroImageUrl navLinks
      headerCta { label href note }
      hero { eyebrow headline subhead highlights cta { label href note } }
      stats { value label }
      scenario { label title paragraphs pullLine }
      problems { label heading items { stat title description } }
      howItWorks { label heading steps { title description } }
      profile { quote attribution role company initials }
      savings { defaultDeposit products { id name apy benefit } }
      meeting { contactName company slots }
      footer { legal badges }
      generatedAt generatedBy
    }
  }
}
`;


const RETAIL_PAGE_QUERY = `
query GetRetailPage($slug: String!) {
  RetailCustomerPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key url { default hierarchical } published lastModified }
      template
      PageTitle MetaDescription CanonicalUrl { default }
      customerSlug customerDisplayName register monthStamp
      editorialIntro stylistNoteBody stylistNoteSignedBy closingReflection
      hero { imageUrl { default } line1 line2 linkTo { default } }
      heldForYou {
        header dynamic
        items { name priceCents priceVisibility imageUrl { default } }
      }
      setAside {
        primaryAction secondaryAction dynamic
        items { name imageUrl { default } }
      }
      atelierNote { title body cta imageUrl { default } }
      smallInvitation { itemName line cta itemImageUrl { default } }
      appointment {
        variant boutique stylistName slotPhrase slots
        primaryAction secondaryAction dynamic
      }
      footerLine
      deviceDegraded generatedAt generatedBy canvasVersion
    }
  }
}
`;

/**
 * Six fields the flat content model never had — CanonicalUrl, FeatureSection and
 * FaqSection on the page, OurHighlight/CompetitorHighlight on ComparisonRow, Weeks
 * on ABMTimelinePhase — were carried forward from the pre-flat nested-block query
 * (a4a6fe7) and sat in this selection returning null on every page for months.
 * Optimizely Graph kept advertising the legacy names in its schema, so the query
 * still parsed; when that schema refreshed, the whole query 400'd and all 2,676
 * account pages 404'd. A selection on one unknown field fails the entire query —
 * check the registered type before adding a field here, and run
 * `npm run check:graph`.
 */
const PAGE_QUERY = ACCOUNT_PAGE_QUERY;

/**
 * Bounded, and a stalled read asked once more (api/_lib/graph-read.ts). A second stall lands in the
 * handler's catch: a 500 with no Cache-Control, so no cache keeps it.
 */
async function queryGraph(authKey: string, query: string, variables: Record<string, unknown>) {
  const { res, json } = await postGraphRead(
    `${GRAPH_ENDPOINT}?auth=${authKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) },
    graphOp(query),
  );
  // A selection on a field Graph does not know fails the WHOLE query: `data`
  // comes back null, and every caller below reads that as "no such page". That
  // is how one schema drift 404'd all 2,676 account pages for days without
  // producing a single log line. Say it out loud instead.
  const errors = (json as { errors?: Array<{ message: string }> })?.errors;
  if (errors?.length) {
    const op = /query\s+(\w+)/.exec(query)?.[1] ?? 'anonymous';
    console.error(
      `[graph] ${op} failed (HTTP ${res.status}) for ${JSON.stringify(variables)}: ` +
        errors.map((e) => e.message).join(' | '),
    );
  }
  return json;
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug;
  const authKey = process.env.GRAPH_AUTH_KEY;

  if (!authKey) {
    return res.status(500).json({ error: 'GRAPH_AUTH_KEY not configured' });
  }

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Missing slug parameter' });
  }

  const normalizedSlug = `/${slug}/`;

  /*
   * Visual Builder experiences (`/vb/:slug`), behind an explicit opt-in.
   *
   * A SEPARATE OPERATION, NOT EXTRA FIELDS ON PAGE_QUERY, and a separate branch rather than
   * another arm of the dispatch chain below. Both halves of that are deliberate: a selection
   * on a field Graph does not know fails the WHOLE query, so a composition selection bolted
   * onto PAGE_QUERY would take the 2,695 CompetitorComparisonPage pages down with it the
   * first time the experience schema moved — and an unconditional extra Graph round trip on
   * the catch-all path would cost every one of those pages latency to answer a question only
   * `/vb/:slug` asks. `kind=experience` keeps the legacy path byte-for-byte what it was.
   */
  if (req.query.kind === 'experience') {
    const tries = [normalizedSlug];
    if (!slug.startsWith('en/')) tries.push(`/en/${slug}/`);
    try {
      for (const s of tries) {
        for (const { typeName, query, template } of EXPERIENCE_QUERIES) {
          const json = await queryGraph(authKey, query, { slug: s });
          const items = graphItems<Record<string, unknown>>(json, typeName);
          if (items && items.length > 0) {
            const shown = await withOfferSignup(await withParentAccount(normalizeExperienceItem({ ...items[0], __typename: typeName, __template: template })));
            res.setHeader('Cache-Control', signupCacheControl(shown, 's-maxage=60, stale-while-revalidate=300'));
            res.setHeader('X-Robots-Tag', 'noindex, nofollow');
            return res.status(200).json(shown);
          }
        }
      }
      return res.status(404).json({ error: 'Experience not found' });
    } catch (err) {
      console.error('[api/content] experience fetch failed:', err);
      return res.status(500).json({ error: 'Failed to fetch content' });
    }
  }

  try {
    // Retail dispatch: try RetailCustomerPage first on every request (CMS
    // rejects '/' in route segments, so retail pages live at flat slugs).
    const retailTries = [normalizedSlug];
    if (!slug.startsWith('en/')) retailTries.push(`/en/${slug}/`);
    if (slug.startsWith('retail/')) {
      const stripped = slug.replace(/^retail\//, '');
      retailTries.push(`/${stripped}/`);
      retailTries.push(`/en/${stripped}/`);
    }
    // PersonPage dispatch. Person pages are the only nested route
    // (/{company}/{person}), so a two-segment slug can only be one of these —
    // try it first and skip the flat-type queries entirely when it hits.
    const personTries = [normalizedSlug];
    if (!slug.startsWith('en/')) personTries.push(`/en/${slug}/`);
    for (const s of personTries) {
      const pJson = await queryGraph(authKey, PERSON_PAGE_QUERY, { slug: s });
      const items = graphItems<PersonPage>(pJson, 'PersonPage');
      if (items && items.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        // Their unpublished words never leave the server (src/www/person-content.ts).
        return res.status(200).json({ ...publicPersonPage(items[0]), __template: 'person' });
      }
    }

    for (const s of retailTries) {
      const json = await queryGraph(authKey, RETAIL_PAGE_QUERY, { slug: s });
      const items = graphItems<RetailCustomerPage>(json, 'RetailCustomerPage');
      if (items && items.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        return res.status(200).json({ ...items[0], __template: 'retail' });
      }
    }

    // FinServ dispatch: try Graph (no-op if the type isn't registered), then
    // synthesize from demo content for known FS slugs.
    const finservTries = [normalizedSlug];
    if (!slug.startsWith('en/')) finservTries.push(`/en/${slug}/`);
    for (const s of finservTries) {
      const fsJson = await queryGraph(authKey, FINSERV_PAGE_QUERY, { slug: s });
      const items = graphItems<FinServPage>(fsJson, 'FinServPage');
      if (items && items.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        return res.status(200).json({ ...items[0], __template: 'finserv' });
      }
    }
    if (isFinServDemoSlug(slug)) {
      const synth = synthFinServPageFromDemo(slug);
      if (synth) {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        return res.status(200).json({ ...synth, __template: 'finserv' });
      }
    }

    let json = await queryGraph(authKey, PAGE_QUERY, { slug: normalizedSlug });
    let items = graphItems<CompetitorComparisonPage>(json, 'CompetitorComparisonPage');

    // Fallback: try with /en/ prefix (Graph stores locale-prefixed URLs)
    if ((!items || items.length === 0) && !slug.startsWith('en/')) {
      const enSlug = `/en/${slug}/`;
      json = await queryGraph(authKey, PAGE_QUERY, { slug: enSlug });
      items = graphItems<CompetitorComparisonPage>(json, 'CompetitorComparisonPage');
    }

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // The page's own copy on the agent platform template (api/_lib/page-copy.ts).
    const page = await withPageCopy(items[0]);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).json(page);
  } catch (err) {
    console.error('[api/content] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch content' });
  }
}
