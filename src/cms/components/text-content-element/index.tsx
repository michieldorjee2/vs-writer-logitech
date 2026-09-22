/**
 * TextContentElement — the prose element.
 *
 * Ports optimizely.com `components/element/text-content-element`, which is four lines of
 * body:
 *
 *   <div className="element text-content-element">
 *     <EditableHtml field="MainBody" html={MainBody?.html} className="prose max-w-none" />
 *   </div>
 *
 * TWO THINGS DIFFER, both forced by the model rather than chosen.
 *
 *   1. `MainBody` IS A BARE STRING, NOT RICH TEXT (DIVERGENCE.md). There is no `.html`, so
 *      there is nothing to inject and `EditableHtml` has no job — RENDERER-SPEC.md's rule
 *      against `dangerouslySetInnerHTML` on a scalar says the same thing from the other side.
 *      The string carries blank lines between paragraphs, so the split happens here and the
 *      result is real `<p>` elements that React escapes. `EditableField` replaces
 *      `EditableHtml`: it is the plain-text half of the same vendored pair and still marks
 *      the field for the CMS on-page editor once a draft route mounts `DraftModeProvider`.
 *      A single newline inside a paragraph is an author's line break, so `whitespace-pre-line`
 *      keeps it.
 *
 *   2. `prose max-w-none` IS DELIBERATELY NOT USED, and this is the one place where copying
 *      upstream verbatim would be the bug. `@tailwindcss/typography` sets `font-size: 1rem`
 *      on `.prose`, and this app runs a 10px root (`tailwind.base-font-size.cjs`), so `prose`
 *      renders body copy at 10px here — it does not on optimizely.com, whose root is 16px.
 *      It also sets `color: var(--tw-prose-body)`, which would pin the copy to a grey and
 *      break `BlankSection`'s `dark_forest` variant, where the section supplies `text-white`
 *      and every element is expected to inherit it. Upstream needs `prose` because rich text
 *      can contain headings, lists and links; this property is guaranteed plain paragraphs,
 *      so the two things `prose` was buying are not needed. The opticom body register comes
 *      from the tokens instead — `font-body text-body-base`, the same pair
 *      `components/block/blockquote-block` uses — and NO text colour is set, so the colour
 *      inherits from the section exactly as the dark variant requires.
 *
 * This element has no display settings at all (`display-settings.ts` declares an empty
 * `settings` array, as upstream does), so nothing is parsed here. Width and rhythm come from
 * the column.
 */
import { EditableField } from '@/lib/optimizely/features/draft'
import type { TextContentElementProps } from './types'

/** A blank line — optionally carrying whitespace — separates paragraphs. */
const PARAGRAPH_BREAK = /\n[ \t]*\n/

export function splitParagraphs(body: string | undefined): string[] {
  if (!body) return []
  return body
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

export default function TextContentElement({ MainBody }: TextContentElementProps) {
  const paragraphs = splitParagraphs(MainBody)

  // Upstream's convention: no content, no shell.
  if (paragraphs.length === 0) return null

  return (
    <div className="element text-content-element">
      <EditableField
        field="MainBody"
        as="div"
        className="font-body text-body-base flex max-w-none flex-col gap-4 leading-[1.45]"
      >
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </EditableField>
    </div>
  )
}
