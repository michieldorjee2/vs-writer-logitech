/**
 * The account page's stakeholders with their LinkedIn photos (src/lib/linkedin-photos.ts), for
 * every path that serves the page: the server render (server/ssr-handler.tsx), the live JSON
 * (api/content.ts) and the CMS preview (api/preview.ts). One extra Graph read with this site's own
 * key, after the page is found, for the profiles its cards link to. Never throws: any failure is
 * the page as it was, cards with initials.
 */
import { graphItems } from '../../src/lib/graph-envelope.js';
import { STAKEHOLDER_PHOTOS_QUERY, attachPhotos, linkedInSlug, type PhotoRecord } from '../../src/lib/linkedin-photos.js';
import { graphOp, postGraphRead } from './graph-read.js';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

type Stakeholder = { Name?: string | null; LinkedInUrl?: { default?: string | null } | null };
type WithStakeholders = { stakeholders?: Stakeholder[] | null };

export async function withStakeholderPhotos<T>(item: T, authKey: string | undefined = process.env.GRAPH_AUTH_KEY): Promise<T> {
  try {
    const people = (item as WithStakeholders | null)?.stakeholders;
    if (!authKey || !Array.isArray(people) || !people.length) return item;
    const ids = [...new Set(people.map((p) => linkedInSlug(p?.LinkedInUrl?.default)).filter((s): s is string => !!s))].slice(0, 20);
    if (!ids.length) return item;
    const { json } = await postGraphRead(
      `${GRAPH_ENDPOINT}?auth=${authKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: STAKEHOLDER_PHOTOS_QUERY, variables: { ids } }) },
      graphOp(STAKEHOLDER_PHOTOS_QUERY),
    );
    const errors = (json as { errors?: Array<{ message?: string }> } | null)?.errors;
    if (errors?.length) {
      console.warn('[stakeholder-photos] Graph:', errors.map((e) => e.message).join(' | ').slice(0, 200));
      return item;
    }
    const records = graphItems<PhotoRecord>(json, 'LimitlessLinkedInPerson') ?? [];
    if (!records.length) return item;
    return { ...item, stakeholders: attachPhotos(people, records) };
  } catch (err) {
    console.warn('[stakeholder-photos] read failed, cards show initials:', err instanceof Error ? err.name : 'error');
    return item;
  }
}
