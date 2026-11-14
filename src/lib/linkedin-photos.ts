/**
 * LinkedIn photos of the people an account page names (its stakeholder cards), read from the
 * Limitless CMS's own Graph. They arrive there as external content: the Mark Down wiki finds a
 * photo only when LinkedIn ties it to the exact profile and shows the page's name and company
 * (wiki DECISIONS.md D44), and the Limitless 1:1 OCP app syncs the verified ones into this
 * Graph as `LimitlessLinkedInPerson` (D45). Each one's `photo_url` is a public, content-addressed
 * wiki address that never changes.
 *
 * The pure half: which LinkedIn profile a card links to, and whether the name LinkedIn shows is
 * the card's name. The server half is api/_lib/stakeholder-photos.ts.
 */

/** Asked as its own Graph request, so a schema problem here can cost photos, never the page. */
export const STAKEHOLDER_PHOTOS_QUERY = `
query StakeholderPhotos($ids: [String]) {
  LimitlessLinkedInPerson(where: { id: { in: $ids } }, limit: 20) {
    items { id name photo_url }
  }
}
`;

/** A card's LinkedIn profile, as the wiki keys it: the part after `/in/`, decoded and lower-cased. */
export function linkedInSlug(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const m = url.trim().match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#\s]+)/i);
  if (!m) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  slug = slug.normalize('NFC').toLowerCase();
  if (slug.length < 2 || slug.length > 100) return null;
  return /^[^\s/?#%"'<>\\\p{Cc}]+$/u.test(slug) ? slug : null;
}

const fold = (s: string): string =>
  s.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[‘’ʼ`´']/g, '');

const DROP = new Set(['dr', 'prof', 'mr', 'mrs', 'ms', 'jr', 'sr', 'ii', 'iii', 'phd', 'mba', 'md']);

function words(name: string): string[] {
  const head = fold(name).replace(/\(.*?\)/g, ' ').split(/[,|•·–—]|\s-\s/)[0] || '';
  return head.split(/[^\p{L}\p{N}]+/u).filter((w) => w && !DROP.has(w));
}

/**
 * The card's name and the name LinkedIn shows are one person's: same first and last word, or
 * every word of the shorter in the longer. The wiki checked this when it kept the photo; this is
 * the same rule again at the card, so a card renamed since then shows initials, not a stranger.
 */
export function sameName(card: unknown, linkedIn: unknown): boolean {
  if (typeof card !== 'string' || typeof linkedIn !== 'string') return false;
  const a = words(card);
  const b = words(linkedIn);
  if (a.length < 2 || b.length < 2 || a[0] !== b[0]) return false;
  if (a[a.length - 1] === b[b.length - 1]) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.every((w) => long.includes(w));
}

/** Only the wiki's public photo addresses are drawn. */
export function isWikiPhoto(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /^\/api\/auth\/people\/linkedin\/p\/[0-9a-f]{32}\.(jpg|png|webp)$/.test(u.pathname);
  } catch {
    return false;
  }
}

export type PhotoRecord = { id?: unknown; name?: unknown; photo_url?: unknown };

/** The stakeholders with `PhotoUrl` set where Graph has their verified photo and the name agrees. */
export function attachPhotos<S extends { Name?: string | null; LinkedInUrl?: { default?: string | null } | null }>(
  stakeholders: S[],
  records: PhotoRecord[],
): Array<S & { PhotoUrl?: string | null }> {
  const byId = new Map<string, PhotoRecord>();
  for (const r of records) if (typeof r.id === 'string') byId.set(r.id, r);
  return stakeholders.map((s) => {
    const slug = linkedInSlug(s.LinkedInUrl?.default);
    const r = slug ? byId.get(slug) : undefined;
    return r && isWikiPhoto(r.photo_url) && sameName(s.Name, r.name) ? { ...s, PhotoUrl: r.photo_url } : s;
  });
}
