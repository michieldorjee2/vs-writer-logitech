/**
 * Shared input validation for the endpoints that hand user-typed text to an
 * Opal agent (opal-create-page, opal-feedback).
 *
 * These endpoints are reachable from the booth UI and cost real money on the
 * far side: one accepted `company_name` becomes a ~12-minute agent run that
 * bills 150-200 credits and publishes a page. The run history shows probe
 * strings arriving through this path and being acted on —
 * `test"; cat /etc/passwd`, `<script>alert(document.domain)</script>`,
 * `test@optimizely.com.evil.com`, `attacker.com` — one of which published a
 * page at /test. Nothing executed, but each one bought a paid agent run with
 * an unvalidated field.
 *
 * So the goal here is not XSS defence (the payload is never rendered as
 * markup by us) — it is refusing to spend credits on input that cannot
 * plausibly be a company name, and bounding what reaches the agent's prompt.
 */

/** Company names are short. Anything longer is not a name. */
export const MAX_COMPANY_NAME = 120;
/** Free-text edit requests get more room, but not unbounded. */
export const MAX_SUGGESTED_EDIT = 4000;
export const MAX_SLUG = 200;

const OPTIMIZELY_EMAIL_RE = /^[^\s@]+@optimizely\.com$/i;
const GENERIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * C0/C1 control characters, minus tab, newline, and carriage return — a
 * multi-line `suggested_edit` is ordinary input, so rejecting newlines here
 * would break the Edit-mode box for anyone who types a paragraph.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

/**
 * Markup, script, and shell/traversal metacharacters. A real company name can
 * carry an apostrophe or an ampersand ("St. Luke's", "Johnson & Johnson"), so
 * those stay legal; what is rejected is the shape of a payload rather than a
 * name.
 */
const PAYLOAD_SHAPES: RegExp[] = [
  /<\s*\/?\s*[a-z][^>]*>/i, // any HTML tag
  /<\s*script/i,
  /javascript\s*:/i,
  /\bon(?:error|load|click|focus)\s*=/i,
  /\$\{|\{\{/, // template interpolation
  /\.\.\//, // path traversal
  /\/etc\/(?:passwd|shadow)/i,
  /[;|`]\s*(?:cat|rm|curl|wget|nc|sh|bash)\b/i,
  /\b(?:union\s+select|drop\s+table|--\s*$)/i,
];

export interface ValidationFailure {
  ok: false;
  error: string;
}
export interface ValidationSuccess<T> {
  ok: true;
  value: T;
}
export type Validated<T> = ValidationSuccess<T> | ValidationFailure;

function fail(error: string): ValidationFailure {
  return { ok: false, error };
}

/**
 * Normalize and validate a free-text field bound for an agent prompt.
 * Collapses whitespace so a name padded with newlines can't smuggle
 * prompt structure past a length check.
 */
export function validateText(
  raw: unknown,
  field: string,
  maxLength: number,
  { requireLetter = false }: { requireLetter?: boolean } = {},
): Validated<string> {
  if (typeof raw !== 'string') return fail(`${field} must be a string`);

  const value = raw.replace(/\s+/g, ' ').trim();

  if (!value) return fail(`${field} is required`);
  if (value.length > maxLength) return fail(`${field} must be ${maxLength} characters or fewer`);
  if (CONTROL_CHARS.test(raw)) return fail(`${field} contains control characters`);
  if (PAYLOAD_SHAPES.some((re) => re.test(value))) return fail(`${field} contains disallowed content`);
  // A name with no letter in it is a probe, a number, or a mistake — never a
  // company worth spending an agent run on.
  if (requireLetter && !/\p{L}/u.test(value)) return fail(`${field} must contain letters`);

  return { ok: true, value };
}

/** Company name: what the booth types into "Add new". */
export function validateCompanyName(raw: unknown): Validated<string> {
  return validateText(raw, 'company_name', MAX_COMPANY_NAME, { requireLetter: true });
}

/**
 * Email of the Optimizely person making the request. `strict` requires an
 * @optimizely.com address — these endpoints spend credits and attribute
 * published pages, so the requester should be identifiable.
 */
export function validateEmail(raw: unknown, { strict }: { strict: boolean }): Validated<string> {
  if (typeof raw !== 'string') return fail('edit_user_email must be a string');
  const value = raw.trim();
  if (!value) return fail('edit_user_email is required');
  if (value.length > 254) return fail('edit_user_email is too long');
  const re = strict ? OPTIMIZELY_EMAIL_RE : GENERIC_EMAIL_RE;
  if (!re.test(value)) {
    return fail(strict ? 'edit_user_email must be an @optimizely.com address' : 'edit_user_email is not a valid email');
  }
  return { ok: true, value };
}
