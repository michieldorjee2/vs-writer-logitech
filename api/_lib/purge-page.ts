/**
 * The edge-cache purge for one page, by the Cache-Tag the SSR handler stamps on it (`page:<key>`).
 * Used when Edit mode's change is saved: by api/edit-status.ts once the CMS republish lands, and
 * by api/opal-edit-stream.ts when it saves the page's own copy.
 */
const VERCEL_API = 'https://api.vercel.com';
/** Canonical Vercel IDs for this project. NOT the URL slugs — the
 *  invalidate-by-tags endpoint accepts the slug forms with a 200 OK
 *  but silently no-ops, which is exactly the kind of mistake that
 *  hides cache bugs in production. Pulled from
 *  `vercel api /v9/projects/aldus`. */
const VERCEL_TEAM_ID = 'team_36vwk4IJMOpRMCwSOu1biPWG';
const VERCEL_PROJECT_ID = 'prj_BXIHuf6RBP5le8pfrxPGhLnb6Uqf';

/** Best-effort Cache-Tag purge. Vercel's tag-based eviction is
 *  eventually consistent — the API returns 200 immediately but the
 *  edge nodes can take anywhere from a few seconds to a minute to
 *  drop the cached entry, which is too slow for the moment the
 *  visitor clicks Refresh right after the toast. The client also
 *  appends a `?refresh=…` cache-buster on that immediate click for
 *  a deterministic first-click experience; this purge then catches
 *  the slower paths (manual Cmd-R later, second-tab visitor, etc.). */
export async function purgePageCache(key: string): Promise<void> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.warn('[purge-page] VERCEL_TOKEN not set — skipping cache purge');
    return;
  }

  const url =
    `${VERCEL_API}/v1/edge-cache/invalidate-by-tags` +
    `?teamId=${encodeURIComponent(VERCEL_TEAM_ID)}` +
    `&projectIdOrName=${encodeURIComponent(VERCEL_PROJECT_ID)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags: [`page:${key}`] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('[purge-page] purge failed', res.status, body.slice(0, 200));
    }
  } catch (err) {
    console.warn('[purge-page] purge fetch error', err);
  }
}

