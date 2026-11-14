/**
 * Teams photos on pages (README, "Teams photos on pages"): what the browser and the server share.
 * No React, no browser, no node: the avatar draws from it, api/page-photo.ts checks with it.
 *
 * Someone from Optimizely named on a page is drawn Gravatar first, then their Microsoft Teams photo,
 * then their initials. Everyone else is drawn as before: a customer's address is never sent anywhere
 * that is not Gravatar already, and never to the wiki or to Limitless.
 *
 * The Teams photo is asked of `/api/page-photo?p=<page>&k=<key>`, never by address. `p` is the page the
 * visitor is on (`logitech/ben-yu`, `vb/spring-dinner`) and `k` is the person's Gravatar hash, which is
 * an opaque key and nothing more: the server finds it among the people that page names, and serves
 * nobody else. The address is in no URL.
 */
import { emailHash, gravatarUrl } from './gravatar';

export const PAGE_PHOTO_PATH = '/api/page-photo';

/**
 * An address at Optimizely, in the shape the wiki's people directory accepts (lib/people-directory.ts
 * there): lower-case, one local part of the usual characters, exactly optimizely.com. `x@optimizely.com.evil.test`,
 * `x@sub.optimizely.com` and `a@b@optimizely.com` are not.
 */
const OPTIMIZELY_ADDRESS = /^[a-z0-9._%+-]{1,64}@optimizely\.com$/;

/** The address tidied and lower-cased when it is an @optimizely.com one; otherwise null. The one gate before anything is sent to the wiki or to Limitless. */
export function optimizelyAddress(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && OPTIMIZELY_ADDRESS.test(email) ? email : null;
}

/** The key a person is asked for by: their Gravatar hash. 32 lower-case hex characters. */
export const PHOTO_KEY = /^[0-9a-f]{32}$/;
export const photoKeyOf = (email: string): string => emailHash(email);

/** The kinds of page that name people from Optimizely, and where the server finds them. */
export type PhotoPageKind = 'account' | 'person' | 'offer';
export interface PhotoPage {
  /** The canonical route, no slashes at the ends, no `en/`, lower-case: the `p` of the URL. */
  path: string;
  kind: PhotoPageKind;
}

const SEGMENT = '[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?';
const ROUTE = new RegExp(`^(?:en/)?(${SEGMENT})(?:/(${SEGMENT}))?$`);
/** First segments that are the site's own addresses, never a page's. */
const NOT_A_PAGE = new Set(['api', 'search', 'login', 'home', 'preview', 'assets', 'logos', 'fonts', 'ocr', 'home-scenes', 's', 'retail']);

/**
 * The page an address is: an offer page (`vb/<slug>`), a person page (`<company>/<person>`) or an
 * account page (`<company>`). A pathname with slashes at the ends and a locale prefix is fine; the
 * answer is the canonical form. Null for anything that is not one of them.
 */
export function photoPageOf(raw: unknown): PhotoPage | null {
  if (typeof raw !== 'string' || raw.length > 420) return null;
  const m = ROUTE.exec(raw.trim().replace(/^\/+|\/+$/g, '').toLowerCase());
  if (!m || NOT_A_PAGE.has(m[1])) return null;
  if (m[1] === 'vb') return m[2] ? { path: `vb/${m[2]}`, kind: 'offer' } : null;
  return m[2] ? { path: `${m[1]}/${m[2]}`, kind: 'person' } : { path: m[1], kind: 'account' };
}

/** The Teams photo's URL for this person on this page, or null when they are not at Optimizely or this is not a page. Same bytes of query every time, so the edge caches it. */
export function pagePhotoUrl(pathname: string | null | undefined, email: string | null | undefined): string | null {
  const page = photoPageOf(pathname);
  const address = optimizelyAddress(email);
  if (!page || !address) return null;
  return `${PAGE_PHOTO_PATH}?p=${encodeURIComponent(page.path)}&k=${photoKeyOf(address)}`;
}

/** What an address that is not Optimizely's gets: Gravatar (as every card that has always drawn one), or only initials (the cards that never did). */
export type OthersGet = 'gravatar' | 'initials';

export interface PhotoSource {
  kind: 'gravatar' | 'teams';
  url: string;
}

/**
 * The photos to try for one person, in order; none means initials. Gravatar first for everyone it
 * has always been asked for, then the Teams photo for Optimizely's own, when the page is known
 * (`pathname` is null on the server, where only the first is ever drawn).
 */
export function avatarSources(
  email: string | null | undefined,
  { size, pathname, others }: { size: number; pathname: string | null; others: OthersGet },
): PhotoSource[] {
  if (!email?.trim()) return [];
  const ours = optimizelyAddress(email);
  const sources: PhotoSource[] = [];
  if (ours || others === 'gravatar') sources.push({ kind: 'gravatar', url: gravatarUrl(email, size) });
  const teams = ours ? pagePhotoUrl(pathname, ours) : null;
  if (teams) sources.push({ kind: 'teams', url: teams });
  return sources;
}
