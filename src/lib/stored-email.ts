/* Shared email storage for booth flows that need an Optimizely-internal
 * contact (Edit mode + the search-page "Add new" prompt).
 *
 * One key, one TTL, one rule: only @optimizely.com addresses are valid. */

const EMAIL_KEY = 'opti.editmode.email.v1';
const EMAIL_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export const OPTIMIZELY_EMAIL_RE = /^[^\s@]+@optimizely\.com$/i;

type StoredEmail = { email: string; setAt: number };

export function loadStoredEmail(): string | null {
  try {
    const raw = localStorage.getItem(EMAIL_KEY);
    if (!raw) return null;
    const parsed: StoredEmail = JSON.parse(raw);
    if (!parsed?.email || typeof parsed.setAt !== 'number') return null;
    if (Date.now() - parsed.setAt > EMAIL_TTL_MS) {
      localStorage.removeItem(EMAIL_KEY);
      return null;
    }
    if (!OPTIMIZELY_EMAIL_RE.test(parsed.email)) {
      localStorage.removeItem(EMAIL_KEY);
      return null;
    }
    return parsed.email;
  } catch {
    return null;
  }
}

export function saveStoredEmail(email: string): void {
  try {
    const payload: StoredEmail = { email, setAt: Date.now() };
    localStorage.setItem(EMAIL_KEY, JSON.stringify(payload));
  } catch {
    /* localStorage might be disabled — silently ignore. */
  }
}

export function isValidOptimizelyEmail(value: string): boolean {
  return OPTIMIZELY_EMAIL_RE.test(value.trim());
}
