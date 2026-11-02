// ─── Sign-in: "Log in with Optimizely" ────────────────────────────────────
// Server-only (node:crypto). Shared by the api/ routes and the SSR handler.
//
// Opti ID through the Mark Down wiki's sign-in relay (md.optimizely.com, its
// D34), the same way aldus-ui and Mark AEO sign in. The wiki's Opti ID client
// only knows the wiki's own callback, so the person is sent there, signed in
// (or recognised from the session they already have), and sent back here with
// a signed, two-minute assertion of who they are. We verify it with the secret
// the wiki holds for this app (OPTIID_RELAY_SECRET; AUTH_RELAY_SECRET_SHOWCASE
// on the wiki) and open our own session.
//
// What it gates: /search, the booth sidebar's tools on `?search=1` pages, and
// the routes behind them (edit, create, the search index). The account pages
// themselves stay public and edge-cached — nothing identity-specific is ever
// server-rendered into them; the sidebar asks /api/auth/me from the browser.
//
// The session is a signed cookie holding the identity, not a server-side
// record: `v2.<base64url(json)>.<mac>`. It lives 180 days and is re-issued
// after a week of use. Rotating SESSION_SECRET signs everyone out.
//
// Unset OPTIID_RELAY_SECRET (local dev) means no gate. The identity is then
// DEV_AUTH_EMAIL when set, and nobody when not — so a deploy that forgot the
// secret cannot edit or create anything, it can only fail to sign in.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export const SESSION_COOKIE = 'showcase_session';
/** The in-flight sign-in: state and where to land, for the callback. */
const FLOW_COOKIE = 'showcase_signin';

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_S = 180 * 24 * 60 * 60;
const REFRESH_AFTER_MS = 7 * DAY_MS;
/** Ten minutes is longer than any real sign-in and shorter than any real risk. */
const FLOW_MAX_AGE_S = 600;

/** The relay registers this app under this id; assertions must name it. */
export const RELAY_APP_ID = 'showcase';

export const START_PATH = '/api/auth/optimizely/start';
const CALLBACK_PATH = '/api/auth/optimizely/callback';

/** The booth tools were always for Optimizely people; the old email prompt enforced the same. */
const OPTIMIZELY_EMAIL_RE = /^[^\s@]+@optimizely\.com$/i;

export function authEnabled(): boolean {
  return Boolean(process.env.OPTIID_RELAY_SECRET);
}

/** The wiki that runs the relay. Its origin is also the `iss` we accept. */
export function wikiOrigin(): string {
  return new URL(process.env.WIKI_URL || 'https://md.optimizely.com').origin;
}

export interface Identity {
  /** Okta's stable user id. */
  sub: string;
  email: string;
  name?: string;
  env: 'prep' | 'prod';
}

function b64url(data: Buffer | string): string {
  return Buffer.from(data).toString('base64url');
}

function equal(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function hmac(key: string, data: string): string {
  return createHmac('sha256', key).update(data).digest('base64url');
}

function sessionKey(): string {
  // SESSION_SECRET when set; otherwise derived from the relay secret, so a
  // deploy that only configures sign-in still signs with something secret.
  return process.env.SESSION_SECRET || `showcase-session:${process.env.OPTIID_RELAY_SECRET ?? ''}`;
}

// ─── The relay's assertion ────────────────────────────────────────────────

interface Assertion extends Identity {
  v: number;
  iss: string;
  aud: string;
  state: string;
  iat: number;
  exp: number;
  jti: string;
}

export type AssertionCheck =
  | { ok: true; identity: Identity; jti: string; exp: number }
  | { ok: false; reason: 'malformed' | 'signature' | 'audience' | 'issuer' | 'expired' | 'state' };

/**
 * Verify what the wiki handed back. Every check is about a different attack:
 * the signature (forgery), audience (an assertion minted for another app),
 * issuer (a wiki we did not send the person to), expiry (a stale link), and
 * state (someone else's sign-in completed in this browser). The caller burns
 * the `jti` so a captured URL cannot be replayed within its two minutes.
 */
export function verifyAssertion(token: string | null, expectedState: string, now = Date.now()): AssertionCheck {
  const secret = process.env.OPTIID_RELAY_SECRET || '';
  if (!token || !secret) return { ok: false, reason: 'malformed' };
  const dot = token.indexOf('.');
  if (dot <= 0) return { ok: false, reason: 'malformed' };
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!equal(signature, hmac(secret, payload))) return { ok: false, reason: 'signature' };

  let claims: Assertion;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as Assertion;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (claims.v !== 1 || !claims.sub || !claims.email || !claims.jti) return { ok: false, reason: 'malformed' };
  if (claims.aud !== RELAY_APP_ID) return { ok: false, reason: 'audience' };
  if (claims.iss !== wikiOrigin()) return { ok: false, reason: 'issuer' };
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < now) return { ok: false, reason: 'expired' };
  if (!expectedState || !equal(String(claims.state), expectedState)) return { ok: false, reason: 'state' };

  return {
    exp: claims.exp,
    identity: {
      email: String(claims.email).toLowerCase(),
      env: claims.env === 'prep' ? 'prep' : 'prod',
      name: typeof claims.name === 'string' && claims.name ? claims.name : undefined,
      sub: String(claims.sub),
    },
    jti: claims.jti,
    ok: true,
  };
}

export function isOptimizelyEmail(email: string): boolean {
  return OPTIMIZELY_EMAIL_RE.test(email);
}

/**
 * Record a one-time id; false when it was already recorded. Fails closed: with
 * no Redis to remember it in, a replay could not be told apart, so it refuses.
 */
export async function claimOnce(jti: string, ttlSeconds: number): Promise<boolean> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return false;
  const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  const set = await redis.set(`auth:jti:${jti}`, 1, { nx: true, ex: ttlSeconds });
  return set === 'OK';
}

// ─── Our own session ──────────────────────────────────────────────────────

interface SessionClaims extends Identity {
  /** Epoch ms the cookie was (re-)issued. */
  iat: number;
}

function issueSession(identity: Identity, now = Date.now()): string {
  const claims: SessionClaims = { ...identity, iat: now };
  const payload = b64url(JSON.stringify(claims));
  return `v2.${payload}.${hmac(sessionKey(), `v2.${payload}`)}`;
}

/** The identity in a live session cookie, and whether it is due for re-issue. */
function readSession(token: string | undefined, now = Date.now()): { identity: Identity | null; refresh: boolean } {
  const none = { identity: null, refresh: false };
  if (!token) return none;
  const [version, payload, signature, ...rest] = token.split('.');
  if (version !== 'v2' || !payload || !signature || rest.length) return none;
  if (!equal(signature, hmac(sessionKey(), `v2.${payload}`))) return none;
  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as SessionClaims;
  } catch {
    return none;
  }
  if (!claims.sub || !claims.email || typeof claims.iat !== 'number') return none;
  // A little clock skew is tolerated; a cookie "issued" in the future is not.
  if (claims.iat > now + 60_000 || now - claims.iat > SESSION_MAX_AGE_S * 1000) return none;
  const { iat: _iat, ...identity } = claims;
  return { identity, refresh: now - claims.iat > REFRESH_AFTER_MS };
}

// ─── Cookies ──────────────────────────────────────────────────────────────

function cookie(name: string, value: string, maxAge: number): string {
  // Lax, not Strict: the relay's redirect back here is a cross-site top-level
  // navigation, and the flow cookie must survive it.
  const parts = [`${name}=${value}`, 'Path=/', `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

/** Add a Set-Cookie without dropping one another step already set. */
function appendCookie(res: VercelResponse, value: string): void {
  const existing = res.getHeader('Set-Cookie');
  const list = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
  res.setHeader('Set-Cookie', [...list, value]);
}

export function setSessionCookie(res: VercelResponse, identity: Identity): void {
  appendCookie(res, cookie(SESSION_COOKIE, issueSession(identity), SESSION_MAX_AGE_S));
}

export function clearSessionCookie(res: VercelResponse): void {
  appendCookie(res, cookie(SESSION_COOKIE, '', 0));
}

export interface SignInFlow {
  next: string;
  state: string;
}

export function setFlowCookie(res: VercelResponse, flow: SignInFlow): void {
  appendCookie(res, cookie(FLOW_COOKIE, b64url(JSON.stringify(flow)), FLOW_MAX_AGE_S));
}

export function clearFlowCookie(res: VercelResponse): void {
  appendCookie(res, cookie(FLOW_COOKIE, '', 0));
}

export function readFlowCookie(req: VercelRequest): Partial<SignInFlow> {
  const raw = req.cookies?.[FLOW_COOKIE];
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8')) as Partial<SignInFlow>;
  } catch {
    return {};
  }
}

// ─── What the routes use ──────────────────────────────────────────────────

function devIdentity(): Identity | null {
  const email = (process.env.DEV_AUTH_EMAIL || '').trim().toLowerCase();
  return email ? { email, env: 'prod', name: undefined, sub: `dev:${email}` } : null;
}

/**
 * Who is asking, or null. Re-issues the cookie when it is due, so someone who
 * keeps using the tools is not sent through Opti ID again. Only call this on a
 * response that is never shared between people (no-store / private).
 */
export function currentIdentity(req: VercelRequest, res: VercelResponse): Identity | null {
  if (!authEnabled()) return devIdentity();
  const session = readSession(req.cookies?.[SESSION_COOKIE]);
  if (session.identity && session.refresh) setSessionCookie(res, session.identity);
  return session.identity;
}

/**
 * For the API routes that act as someone: the identity, or a 401 already sent.
 * The email those routes forward to Opal comes from here and nowhere else — a
 * request body cannot name someone else.
 */
export function requireIdentity(req: VercelRequest, res: VercelResponse): Identity | null {
  const identity = currentIdentity(req, res);
  if (identity) return identity;
  res.setHeader('Cache-Control', 'no-store');
  res.status(401).json({ error: 'Sign in with Optimizely first.' });
  return null;
}

/** A same-origin path to return to after signing in; anything else is the default. */
export function safeNext(value: unknown, fallback = '/search'): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
  // `//host` and `/\host` are protocol-relative: a redirect there leaves the site.
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}

/** Where to send someone to sign in and come back to `next`. */
export function signInPath(next: string): string {
  return `${START_PATH}?next=${encodeURIComponent(safeNext(next))}`;
}

/** This deployment's origin, as the browser sees it. */
export function requestOrigin(req: VercelRequest): string {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost');
  return `${proto}://${host}`;
}

export function callbackUrl(req: VercelRequest): string {
  return `${requestOrigin(req)}${CALLBACK_PATH}`;
}

export function randomState(): string {
  return randomBytes(32).toString('base64url');
}

export function firstQuery(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
