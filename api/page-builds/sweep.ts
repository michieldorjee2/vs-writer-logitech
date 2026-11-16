import type { VercelRequest, VercelResponse } from '@vercel/node';
import { markConfigured } from '../_lib/mark.js';
import { OPEN_KEY, buildStore, getBuild, openBuildIds } from '../_lib/page-builds-store.js';
import { refreshBuild } from '../_lib/page-builds.js';

/**
 * GET /api/page-builds/sweep — Vercel Cron, every 10 minutes (vercel.json).
 *
 * A build only moves on when someone looks at it (refreshBuild, from the search page's list
 * or the page's own address). A rep who asks and closes the tab would leave a failed build
 * unseen, and a person build waiting for its company page unstarted. The sweep looks at every
 * open build (pb:open), so a failure is settled, and emailed (build-alerts.ts), within ten
 * minutes whoever is watching, and a waiting person build starts once its company is done.
 *
 * Only Vercel Cron may call it: it sends `Authorization: Bearer $CRON_SECRET`. No CRON_SECRET,
 * no sweep (a missing secret must not leave this open).
 */
const PER_SWEEP = 50;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  const store = buildStore();
  if (!store || !markConfigured()) return res.status(503).json({ error: 'Page builds are not configured' });

  const ids = await openBuildIds(store);
  let checked = 0;
  let settled = 0;
  let gone = 0;
  for (const id of ids.slice(0, PER_SWEEP)) {
    try {
      const record = await getBuild(store, id);
      if (!record) {
        await store.srem(OPEN_KEY, id);
        gone++;
        continue;
      }
      const { record: fresh } = await refreshBuild(store, record);
      checked++;
      if (fresh.status === 'done' || fresh.status === 'failed') settled++;
    } catch (err) {
      console.error('[page-builds] sweep', id, err);
    }
  }
  console.log(`[page-builds] sweep: ${ids.length} open, ${checked} checked, ${settled} settled, ${gone} gone`);
  return res.status(200).json({ open: ids.length, checked, settled, gone });
}
