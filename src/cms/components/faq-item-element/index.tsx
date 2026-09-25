/**
 * FaqItemElement — one expandable question, on the vendored optimizely.com accordion primitive
 * (the same rounded row, padding, rotating chevron and spring open as the site's own FAQ).
 *
 * Each item is an independent element node, so each renders its OWN single-item accordion root:
 * items open and close independently, which is also how the site's FAQ behaves in practice.
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/_ui/accordion'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import type { FaqItemElementProps } from './types'

export default function FaqItemElement({ Question, Answer, displaySettings }: FaqItemElementProps) {
  const question = Question?.trim()
  // A question with no answer is a promise the page cannot keep; render nothing.
  if (!question || !Answer?.trim()) return null

  const { color } = parseDisplaySettings<{ color?: 'neutral2' | 'white' }>(
    displaySettings as unknown as DisplaySettings
  )
  const bg = color === 'white' ? 'bg-(--color-primary-1)' : 'bg-(--color-tertiary-2)'
  const paragraphs = Answer.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  return (
    <Accordion type="single" collapsible className="faq-item-element">
      <AccordionItem value="faq" className={bg}>
        <AccordionTrigger data-epi-edit="Question">{question}</AccordionTrigger>
        <AccordionContent>
          <div data-epi-edit="Answer" className="font-body text-body-base flex flex-col gap-3 pt-4 leading-[1.5] text-(--color-tertiary-midfir)">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
