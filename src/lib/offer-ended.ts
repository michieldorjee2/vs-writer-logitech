/**
 * An offer page whose offer has ended (Laura, 12 Nov 2026: "pages are not 'self destroying' once
 * the offer ends"). Limitless says when an offer has ended (aldus-ui hasEnded: ended by hand, or
 * Active or Paused past its last day; a Draft never); api/_lib/offer-ended.ts asks it when the
 * page is served and, once it has, serves this instead of the page: the company's mark, one line
 * saying the offer is over, and a way on. Nothing of the page's own content is sent, so an ended
 * offer's copy, sign-up and hosts stop being served the moment Limitless says so. The CMS page is
 * untouched: extend the offer in Limitless and the page is back.
 *
 * Client-safe: the /vb/ route (VisualBuilderPage.tsx) and the server (server/ssr-handler.tsx)
 * both draw it from this shape.
 */

/** Marks an experience as an ended offer's stand-in. */
export const ENDED_FLAG = '__offerEnded' as const;

export interface EndedOffer {
  __typename: 'ABMExperience';
  __template?: unknown;
  [ENDED_FLAG]: true;
  _metadata?: { key?: string | null; url?: { hierarchical?: string | null } | null } | null;
  companyName: string | null;
  customerLogo: { default: string | null } | null;
  /** The company's own page on this site ("/acme/"), when it has one. */
  accountUrl: string | null;
  PageTitle: string;
  noIndex: true;
}

export const ENDED_WORDS = {
  title: 'This offer has ended',
  heading: 'This offer has ended',
  withAccount: (company: string) => `Thanks for stopping by. ${company}'s page is still here, with everything we put together for your team.`,
  withoutAccount: 'Thanks for stopping by. There is plenty more to see at Optimizely.',
  toAccount: (company: string) => `See ${company}'s page`,
  toOptimizely: 'Visit optimizely.com',
  madeFor: (company: string) => `Made for ${company}`,
} as const;

export const OPTIMIZELY_HOME = 'https://www.optimizely.com/';

export function isEndedOffer(value: unknown): value is EndedOffer {
  return !!value && typeof value === 'object' && (value as Record<string, unknown>)[ENDED_FLAG] === true;
}

/** A site-relative account page address ("/acme/"), or null: never another origin, never a protocol-relative "//". */
export function safeAccountUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const path = url.trim();
  // A slash then a word character: never "//host" or "/\\host" (another origin), never a scheme.
  if (!/^\/[\w-]/.test(path) || /[\s\\]/.test(path)) return null;
  return path.endsWith('/') ? path : `${path}/`;
}

/** The stand-in for an ended offer's page: its identity and the company's mark only. */
export function endedOffer(
  page: {
    __template?: unknown;
    _metadata?: { key?: string | null; url?: { hierarchical?: string | null } | null } | null;
    companyName?: unknown;
    customerLogo?: { default?: string | null } | null;
  },
  accountUrl: string | null,
): EndedOffer {
  return {
    __typename: 'ABMExperience',
    __template: page.__template,
    [ENDED_FLAG]: true,
    _metadata: page._metadata ? { key: page._metadata.key ?? null, url: page._metadata.url ?? null } : null,
    companyName: typeof page.companyName === 'string' && page.companyName.trim() ? page.companyName.trim() : null,
    customerLogo: page.customerLogo?.default ? { default: page.customerLogo.default } : null,
    accountUrl: safeAccountUrl(accountUrl),
    PageTitle: ENDED_WORDS.title,
    noIndex: true,
  };
}
