/**
 * The `suggested_edit` Edit mode sends Mark (account_page_live_edit): one block per commented
 * section, separated by `---` rules so the agent can split them back apart.
 *
 * On the www agent platform page each block also names the stored fields that drive that
 * section, and the whole message opens with a line saying which template the page is, so Mark
 * edits those fields only and knows the rest of the page is template copy (agent v1.4).
 */
export const AGENT_PLATFORM_TEMPLATE_LINE =
  'Page template: agent platform. Only the fields listed under each section can change; labels and the proof stories stay as they are. Send each changed field as "field" with its full new value as "value". Fields starting "copy." are this page\'s own text, with no CMS property: their text now is under "Now"; send the new text as the value and it is saved with the edit, so don\'t put them in update_page.'

export interface SectionComment {
  title: string
  feedback: string
  /** CompetitorComparisonPage property keys or copy fields behind the section (agent platform page only). */
  fields?: string[]
  /** The text each copy field shows now, by field ("copy.hero.h1" -> the headline). */
  copy?: Record<string, string | string[]>
}

/**
 * The request to Mark. On either account template and the person page each section names its
 * `Fields:` (the stored fields it shows, so Mark changes exactly those); the agent platform request
 * also opens with its template line and gives each copy field's text under `Now:`.
 */
export function buildSuggestedEdit(comments: SectionComment[], template?: 'agent-platform' | 'takeout' | 'person'): string {
  const blocks = comments.map((c) => {
    if (!template || !c.fields?.length) return `Section: ${c.title}\nFeedback: ${c.feedback}`
    const now = Object.entries(c.copy ?? {})
      .filter(([f]) => c.fields!.includes(f))
      .map(([f, v]) => `  ${f} = ${JSON.stringify(v)}`)
    return [`Section: ${c.title}`, `Fields: ${c.fields.join(', ')}`, ...(now.length ? ['Now:', ...now] : []), `Feedback: ${c.feedback}`].join('\n')
  })
  const body = blocks.join('\n\n---\n\n')
  return template === 'agent-platform' ? `${AGENT_PLATFORM_TEMPLATE_LINE}\n\n${body}` : body
}
