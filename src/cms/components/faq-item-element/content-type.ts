import {
  longString,
  sequence,
  shortString,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * One question and its answer. optimizely.com's FAQ is an AccordionBlock holding
 * AccordionEntryBlock REFERENCES, which an element may not hold (content references are
 * section-only — see the contract doc), so here each Q/A is its own element node and an FAQ is
 * N of them stacked in a column. Generic, not ABM-specific: any page can use it.
 */
const contentType: ContentTypeDefinition = {
  key: 'FaqItemElement',
  displayName: 'FAQ Item',
  description:
    'One frequently asked question and its answer, rendered as an expandable row. An FAQ section is one of these per question.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Question: shortString('Question', {
      description: 'The question as a reader would ask it, e.g. "Is this really free?".',
      maxLength: 200,
    }),
    Answer: longString('Answer', {
      description: 'A direct answer in one to three sentences. Plain text; blank lines become paragraphs.',
    }),
  }),
}

export default contentType
