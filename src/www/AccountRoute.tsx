/**
 * An account page: the template its own pitch calls for (./account-template.ts). The server
 * render, the client, and the CMS preview all draw an account page through this.
 *
 * `search` is the request's query string, read only by the agent platform template (its `?state=`
 * and `?review=1` review tools). The server passes `url.search`, the client its own, so both
 * draw the same page and hydration holds.
 */
import type { CompetitorComparisonPage } from '../lib/graph-types'
import AccountPage from './AccountPage'
import AgentPlatformPage from './AgentPlatformPage'
import { accountTemplateOf } from './account-template'

export default function AccountRoute({ page, search = '' }: { page: CompetitorComparisonPage; search?: string }) {
  return accountTemplateOf(page) === 'agent-platform' ? <AgentPlatformPage page={page} search={search} /> : <AccountPage page={page} />
}
