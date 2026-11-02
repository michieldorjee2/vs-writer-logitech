/**
 * An account page in the www design: which template it renders.
 *
 *   default             the agent platform template (Laura's, from Dan's pitch): ./AgentPlatformPage
 *   ?template=takeout   the competitive takeout template, every stored field: ./AccountPage
 *
 * `search` is the request's query string. The server passes `url.search`, the client its own
 * `location.search`, so both pick the same template and the same state and hydration holds.
 */
import type { CompetitorComparisonPage } from '../lib/graph-types'
import AccountPage from './AccountPage'
import AgentPlatformPage from './AgentPlatformPage'
import { wantsTakeout } from './design'

export default function WwwAccountRoute({ page, search = '' }: { page: CompetitorComparisonPage; search?: string }) {
  return wantsTakeout(search) ? <AccountPage page={page} /> : <AgentPlatformPage page={page} search={search} />
}
