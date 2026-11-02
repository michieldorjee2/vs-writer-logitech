import { graphql, type ResultOf } from '../../../lib/optimizely/graphql'
import displaySettingsData from './display-settings'
import type { ExtractDisplaySettingValues } from '../../../lib/optimizely/types/display-settings'

// Local fragment mirroring the cmp_PublicImageAsset projection used inside
// every CompanyBlock logo reference.
const CompanyLogoAssetFragment = graphql(`
  fragment CompanyLogoAssetFragment on cmp_PublicImageAsset {
    __typename
    Url
    AltText
    Width
    Height
  }
`)

// CompanyBlock is widely composed by templates that construct props directly
// via JSX, so CompanyBlockProps allows fragment-derived fields to be optional
// and adds the additional projections passed in by templates.
export const CompanyBlockFragment = graphql(
  `
    fragment CompanyBlockFragment on CompanyBlock {
      __typename
      CompanyName
      CompanyColor
      ExternalId
      IsTechPartner
      Tier
      TechPartnerEmail
      TechPartnerDescription
      TechPartnerLocations
      VideoWistiaId
      YoutubeId
      WebsiteUrl {
        default
      }
      NavigationUrlOverride {
        default
      }
      LogoMark {
        url {
          default
        }
        item {
          ...CompanyLogoAssetFragment
        }
      }
      LogoMarkLight {
        url {
          default
        }
        item {
          ...CompanyLogoAssetFragment
        }
      }
      FullColorLogoContentLink {
        url {
          default
        }
        item {
          ...CompanyLogoAssetFragment
        }
      }
      LightLogoContentLink {
        url {
          default
        }
        item {
          ...CompanyLogoAssetFragment
        }
      }
      DarkLogoContentLink {
        url {
          default
        }
      }
    }
  `,
  [CompanyLogoAssetFragment]
)

// Derived from the fragment + the runtime extras supplied by the still-
// legacy production fragment selections (TechPartner* rich text and link
// arrays). Templates construct CompanyBlock props directly via JSX without
// the FragmentOf wrapping, so fragment fields are made optional via Partial.
// Logo references are widened so templates can pass either the fragment
// projection or a generic ContentReference shape.
type LogoReferenceLike = {
  url?: { default?: string | null } | null
  item?: unknown
} | null

export type CompanyBlockDisplaySettings = ExtractDisplaySettingValues<
  (typeof displaySettingsData)[0]['settings']
>

export type CompanyBlockProps = Partial<
  Omit<
    ResultOf<typeof CompanyBlockFragment>,
    | 'LogoMark'
    | 'LogoMarkLight'
    | 'FullColorLogoContentLink'
    | 'LightLogoContentLink'
    | 'DarkLogoContentLink'
  >
> & {
  LogoMark?: LogoReferenceLike
  LogoMarkLight?: LogoReferenceLike
  FullColorLogoContentLink?: LogoReferenceLike
  LightLogoContentLink?: LogoReferenceLike
  DarkLogoContentLink?: LogoReferenceLike
  displaySettings?: Partial<CompanyBlockDisplaySettings>
  preview?: boolean
  TechPartnerMainBodyContent?: { html?: string | null } | null
  TechPartnerImportContent?: { html?: string | null } | null
  TechPartnerTermsAndConditions?: { html?: string | null } | null
  TechPartnerDownloads?: Array<{
    url?: { default?: string | null } | null
  } | null> | null
  TechPartnerLinks?: Array<{
    title?: string | null
    text?: string | null
  } | null> | null
  AssociatedApps?: Array<{
    url?: { default?: string | null } | null
  } | null> | null
  Partners?: Array<{ url?: { default?: string | null } | null } | null> | null
}

// Backward-compatible alias so existing callers that reference the legacy
// Extended* prop type keep compiling.
export type ExtendedCompanyBlockProps = CompanyBlockProps
