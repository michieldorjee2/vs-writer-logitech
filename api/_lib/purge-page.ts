/**
 * The edge-cache purge for pages, by the tag the SSR handler stamps on each page's HTML
 * (`page:<key>`, server/ssr-handler.tsx). Used:
 *   - on every CMS publish and delete (api/cms-published.ts, the CMS's own webhook);
 *   - when Edit mode's change is saved: by api/edit-status.ts once the CMS republish lands, and
 *     by api/opal-edit-stream.ts when it saves the page's own copy.
 *
 * Deleted, not invalidated: Vercel's invalidate-by-tags serves the old copy once more while it
 * refreshes, and a copy that was just taken off a page (the 6 Nov conversation fixes) must not be
 * shown to the next visitor. The next request after a delete renders afresh.
 */
const VERCEL_API = 'https://api.vercel.com';
/** Canonical Vercel IDs for this project. NOT the URL slugs — the
 *  tag endpoints accept the slug forms with a 200 OK
 *  but silently no-op, which is exactly the kind of mistake that
 *  hides cache bugs in production. Pulled from
 *  `vercel api /v9/projects/aldus`. */
const VERCEL_TEAM_ID = 'team_36vwk4IJMOpRMCwSOu1biPWG';
const VERCEL_PROJECT_ID = 'prj_BXIHuf6RBP5le8pfrxPGhLnb6Uqf';

/** The cache tag on a page's HTML. Keep the SSR handler's header the same (scripts/check-cms-purge.ts). */
export function pageTag(key: string): string {
  return `page:${key}`;
}

export type PurgeResult = { ok: boolean; status?: number; skipped?: 'no-token' | 'no-keys'; error?: string };

/** Delete the edge cache of these pages (every address they were cached at: `/x/`, `/x?search=1`, …). */
export async function purgePages(keys: string[], fetchImpl: typeof fetch = fetch): Promise<PurgeResult> {
  const tags = [...new Set(keys)].map(pageTag);
  if (!tags.length) return { ok: true, skipped: 'no-keys' };
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.warn('[purge-page] VERCEL_TOKEN not set — skipping cache purge');
    return { ok: false, skipped: 'no-token' };
  }

  const url =
    `${VERCEL_API}/v1/edge-cache/dangerously-delete-by-tags` +
    `?teamId=${encodeURIComponent(VERCEL_TEAM_ID)}` +
    `&projectIdOrName=${encodeURIComponent(VERCEL_PROJECT_ID)}`;

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('[purge-page] purge failed', res.status, body.slice(0, 200));
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    console.warn('[purge-page] purge fetch error', err);
    return { ok: false, error: err instanceof Error ? err.name : 'error' };
  }
}

/** Best-effort purge of one page. */
export async function purgePageCache(key: string): Promise<void> {
  await purgePages([key]);
}
