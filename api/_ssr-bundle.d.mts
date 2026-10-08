/**
 * Types for api/_ssr-bundle.mjs, which scripts/build-ssr.mjs generates from
 * server/ssr-handler.tsx on every build and .gitignore keeps out of the repo.
 *
 * Without this, `npm run typecheck:server` fails on any checkout that has not
 * been built yet — api/ssr.ts imports a file that does not exist. TypeScript
 * resolves `./_ssr-bundle.mjs` to this declaration first, so the check no
 * longer depends on build order.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

declare const handler: (req: VercelRequest, res: VercelResponse) => Promise<void>;
export default handler;
