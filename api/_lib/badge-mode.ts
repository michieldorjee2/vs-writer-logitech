/**
 * Whether Mark's badge reader is on (api/badge-read.ts reads badges, and
 * server/ssr-handler.tsx tells /search whether to show its camera). No imports,
 * so the page render can ask without loading the reader.
 *
 * Off until MARK_BADGE_AGENT_ID names the reader (and OPAL_PAT is set). The
 * local preview's stand-in, BADGE_READ_STUB, is refused whenever VERCEL_ENV or
 * NODE_ENV is production.
 */

export type Env = Record<string, string | undefined>;
export type BadgeMode = 'off' | 'stub' | 'live';

/** The stub never answers in production, whatever the env says. */
export const stubRefused = (env: Env) => env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';

export const badgeAgentId = (env: Env = process.env) => (env.MARK_BADGE_AGENT_ID || '').trim();

export function badgeMode(env: Env = process.env): BadgeMode {
  if ((env.BADGE_READ_STUB || '').trim() && !stubRefused(env)) return 'stub';
  if (env.OPAL_PAT && badgeAgentId(env)) return 'live';
  return 'off';
}

/** What /search's #root carries when the reader is on (src/lib/badge-scan.ts servedBadgeReady), else nothing. */
export const badgeRootAttr = (env: Env = process.env) => (badgeMode(env) === 'off' ? '' : ' data-badge="on"');
