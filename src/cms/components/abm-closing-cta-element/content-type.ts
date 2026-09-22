import {
  longString,
  sequence,
  shortString,
  url,
  type ContentTypeDefinition,
} from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'AbmClosingCtaElement',
  displayName: 'ABM · Closing CTA',
  // A content type's `description` is capped at 255 characters by the API
  // (`field: Description`, `code: InvalidModel`). Property descriptions are not.
  description:
    'The contact-close block at the foot of an ABM account page: a headline, a short pitch, ' +
    'and the button that opens the scheduling modal. Backs ctaTitle, ctaDescription, ' +
    'ctaButtonText and modalScheduleUrl. No upstream counterpart.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Title: shortString('Title', {
      description: 'The closing headline. Maps the Limitless ctaTitle field.',
      required: true,
    }),
    Description: longString('Description', {
      description:
        'A short paragraph under the headline. Maps ctaDescription. A bare long string, not ' +
        'richText — richText cannot be created through the CMS API, and generated prose ' +
        'containing a stray "<" would fail an HTML-validated write.',
    }),
    ButtonText: shortString('Button text', {
      description: 'The label on the scheduling button. Maps ctaButtonText.',
      maxLength: 40,
    }),
    ScheduleUrl: url('Schedule URL', {
      description:
        'The booking link the button opens. Maps modalScheduleUrl. Optional, because the ' +
        'headline and pitch still read as a close when no link has been issued for the account.',
    }),
  }),
}

export default contentType
