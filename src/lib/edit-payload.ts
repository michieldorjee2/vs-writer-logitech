/**
 * The `suggested_edit` Edit mode sends Mark (account_page_live_edit): one block per commented
 * section, separated by `---` rules so the agent can split them back apart.
 *
 * On the www agent platform page each block also names the stored fields that drive that
 * section, and the whole message opens with a line saying which template the page is, so Mark
 * edits those fields only and knows the rest of the page is template copy (agent v1.4).
 */
export const AGENT_PLATFORM_TEMPLATE_LINE =
  'Page template: agent platform. Only the fields listed under each section can change; the rest of the page is template copy, the same on every page. Send each changed field as "field" with its full new value as "value".'

export interface SectionComment {
  title: string
  feedback: string
  /** CompetitorComparisonPage property keys behind the section (agent platform page only). */
  fields?: string[]
}

export function buildSuggestedEdit(comments: SectionComment[], template?: 'agent-platform'): string {
  const blocks = comments.map((c) =>
    template === 'agent-platform' && c.fields?.length
      ? `Section: ${c.title}\nFields: ${c.fields.join(', ')}\nFeedback: ${c.feedback}`
      : `Section: ${c.title}\nFeedback: ${c.feedback}`,
  )
  const body = blocks.join('\n\n---\n\n')
  return template === 'agent-platform' ? `${AGENT_PLATFORM_TEMPLATE_LINE}\n\n${body}` : body
}
