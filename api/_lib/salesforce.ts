/**
 * Salesforce, read through Mark's own Salesforce tool (tools-mgmt-service
 * invoke), as the OPAL_PAT's owner: the same connection the account workflow's
 * gather step uses, so the search page and the build agree on what an account is.
 * Read-only: the one tool called here only lists records (Accounts for the search page,
 * Opportunities for Activity mode).
 *
 * Env: OPAL_PAT (required), OPAL_BASE_URL, OPAL_INSTANCE_ID, OPAL_REGION.
 */
import {
  domainLabel,
  domainLevels,
  domainOf,
  namePatterns,
  searchTerm,
  storedForms,
  type SalesforceAccountRow,
} from '../../src/lib/account-match.js';

const BASE_URL = (process.env.OPAL_BASE_URL || 'https://opal.optimizely.com').replace(/\/+$/, '');
const INSTANCE_ID = process.env.OPAL_INSTANCE_ID || '4f42a24e93f945bcb262bff01a9a1562';
const REGION = process.env.OPAL_REGION || 'US';
/* A rep is waiting on the search page; Salesforce answers in about two seconds. */
const TIMEOUT_MS = 15_000;
const PER_CALL = 25;

const ACCOUNT_FIELDS = 'Name,Domain_Name__c,Website,Customer_Stage__c,ParentId,Target_Account__c,BillingCountry,Owner.Name';

/**
 * The rows in the tool's answer: `{ success, data: { records: [...] } }` (what it sends, 3 Nov
 * 2026), or `data` as the list itself. Null for a failure or a shape not seen before.
 */
export function rowsOf(response: unknown): SalesforceAccountRow[] | null {
  if (!response || typeof response !== 'object') return null;
  const r = response as { success?: boolean; data?: unknown; totalCount?: unknown };
  if (r.success === false) return null;
  // No match is `{ success: true, data: { error: "No Account records found…" }, totalCount: 0 }`.
  if (r.success === true && r.totalCount === 0) return [];
  const list = Array.isArray(r.data) ? r.data : (r.data as { records?: unknown } | undefined)?.records;
  if (!Array.isArray(list)) return null;
  return list.filter((x): x is SalesforceAccountRow => !!x && typeof x === 'object');
}

/** The rows, or null when Salesforce did not answer (never read as "no accounts"). */
async function listAccounts(filters: Record<string, unknown>): Promise<SalesforceAccountRow[] | null> {
  return listRecords<SalesforceAccountRow>('Account', ACCOUNT_FIELDS, filters, { sortBy: 'Name', sortOrder: 'ASC', limit: PER_CALL, title: 'Accounts' });
}

/**
 * Records of one Salesforce object through the tool, or null when Salesforce did not answer.
 * `objectType` and `fields` are constants of this file; `filters` values come from validated ids.
 */
async function listRecords<T>(
  objectType: string,
  fields: string,
  filters: Record<string, unknown>,
  opts: { sortBy: string; sortOrder: 'ASC' | 'DESC'; limit: number; title: string },
): Promise<T[] | null> {
  const pat = process.env.OPAL_PAT;
  if (!pat) return null;
  try {
    const r = await fetch(`${BASE_URL}/tools-mgmt-service/api/tools/organizations/${INSTANCE_ID}/tools/invoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/json',
        'x-instance-id': INSTANCE_ID,
        'x-opal-client-type': 'web',
        'x-opal-region': REGION,
      },
      body: JSON.stringify({
        tool_name: 'salesforce_crm_list_object',
        timeout: 12,
        parameters: { objectType, fields, filters: JSON.stringify(filters), ...opts },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) {
      console.warn(`[salesforce] ${objectType} list answered ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
      return null;
    }
    const body = (await r.json()) as { response?: unknown };
    const rows = rowsOf(typeof body.response === 'string' ? JSON.parse(body.response) : body.response);
    if (!rows) {
      console.warn(`[salesforce] ${objectType} list answer not understood:`, JSON.stringify(body).slice(0, 200));
      return null;
    }
    return rows as unknown as T[];
  } catch (err) {
    console.warn(`[salesforce] ${objectType} list failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export interface OpportunityRow {
  Name?: string;
  StageName?: string;
  Amount?: number | null;
  CurrencyIsoCode?: string | null;
  CloseDate?: string | null;
  IsClosed?: boolean;
  IsWon?: boolean;
}

/** An account's opportunities, newest close date first (at most 25), or null when Salesforce did not answer. */
export async function listOpportunities(accountId: string): Promise<OpportunityRow[] | null> {
  if (!/^[A-Za-z0-9]{15}([A-Za-z0-9]{3})?$/.test(accountId)) return [];
  return listRecords<OpportunityRow>('Opportunity', 'Name,StageName,Amount,CurrencyIsoCode,CloseDate,IsClosed,IsWon', { AccountId: accountId }, {
    sortBy: 'CloseDate',
    sortOrder: 'DESC',
    limit: PER_CALL,
    title: 'Opportunities',
  });
}

/**
 * The Account records that could be what the rep typed: by website (any way
 * Domain_Name__c spells it, and its parent domains) and by name (the name, or
 * one of its words, starts with it). `failed` when Salesforce did not answer.
 */
export async function findAccounts(query: string): Promise<{ rows: SalesforceAccountRow[]; failed: boolean }> {
  const domain = domainOf(query);
  const term = searchTerm(domain ? domainLabel(domain) : query);
  const calls: Promise<SalesforceAccountRow[] | null>[] = [];
  if (domain) calls.push(listAccounts({ Domain_Name__c: { $in: domainLevels(domain).flatMap(storedForms) } }));
  if (term) calls.push(listAccounts({ Name: { $like: namePatterns(term) } }));
  if (!calls.length) return { rows: [], failed: false };
  const answers = await Promise.all(calls);
  if (answers.every((a) => a === null)) return { rows: [], failed: true };
  let rows = answers.flatMap((a) => a ?? []);
  // "levis", typed for Levi's, is "Levi Strauss & Co.": try the word without its s.
  if (!rows.length && term && /[a-z]{3}s$/i.test(term)) {
    const fallback = await listAccounts({ Name: { $like: namePatterns(term.slice(0, -1)) } });
    if (fallback) rows = fallback;
  }
  return { rows, failed: false };
}
