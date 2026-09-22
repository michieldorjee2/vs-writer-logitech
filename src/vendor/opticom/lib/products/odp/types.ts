// [vendor patch] Upstream declares Window.zaius / _iaq / optimizely here. The repo already
// declares Window.zaius in src/hooks/useOdpTracking.ts with a different shape, and two
// conflicting augmentations fail BOTH files. See UPSTREAM.md.

export interface OptimizelyOneService<T> {
  order: Readonly<number>
  isActive: Readonly<boolean>
  code: Readonly<string>
  debug: boolean

  /**
   * Perform any actions that must be done to apply the capabilities of this
   * service on the page. This function MUST NOT perform behaviour tracking of
   * any kind.
   *
   * @param       path        The path for which to activate.
   * @returns     void
   */
  activatePage?: (path: string) => void

  /**
   * Perform any actions that must be done to performt the pageview tracking
   * needed for this service.
   *
   * @param       path        The path for which to activate.
   * @returns     void
   */
  trackPage?: (path: string) => void

  trackEvent?: (event: OptimizelyOneEvent) => void

  updateProfile?: (profileData: OptimizelyOneProfileData) => void

  discoverProfileData?: (
    signal?: AbortSignal | null
  ) => Promise<OptimizelyOneProfileData>

  getBrowserApi: () => T | undefined
}

export type OptimizelyOneEvent =
  | NavigationSearchEvent
  | {
      event: string
      action: string
      [key: string]: string | number | boolean
    }

type NavigationSearchEvent = {
  event: 'navigation'
  action: 'search'
  search_term: string
}

export type OptimizelyOneProfileData = {
  content_intelligence_id?: string
  custom: Record<string, unknown>
}

export type OptimizelyDataPlatformApi = {
  event: (name: string, data?: { [param: string]: unknown }) => Promise<void>
  dispatch: (
    group: string,
    action: string,
    params?: { [param: string]: unknown }
  ) => Promise<void>
  customer: (
    customerIds: Record<string, string | number>,
    customerAttributes?: Record<string, unknown>
  ) => void
}

export type OptimizelyContentRecsApi = {
  push: (command: [string, unknown]) => void
}

export type OptimizelyWebExperimentationApi = {
  initialized?: boolean
  push: (data: { type: string; [paramName: string]: unknown }) => void
  get?: <T extends keyof OptlyWebGet>(what: T) => OptlyWebGet[T]
}

export type OptlyWebGet = {
  state: {
    getPageStates: (filters?: { isActive: boolean }) => {
      [id: string]: {
        id: string
        apiName: string
        name: string | null
        isActive: boolean
      }
    }
    getExperimentStates: (filters?: { isActive: boolean }) => {
      [id: string]: {
        audiences: string[]
        experimentName: string | null
        id: string
        isActive: boolean
        isInExperimentHoldback: boolean
        reason?: undefined | string
        variation: {
          id: string
          name: string | null
        }
        visitorRedirected: boolean
      }
    }
    getCampaignStates: (filters?: { isActive: boolean }) => {
      [id: string]: {
        allExperiments: {
          id: string
          name: string
        }[]
        audiences: {
          id: string
          name: string
        }[]
        campaignName: string
        experiment: {
          campaignName: string
          id: string
          name: string
        }
        id: string
        isActive: boolean
        isInCampaignHoldback: boolean
        reason?: unknown
        variation: {
          id: string
          name: string
        }
        visitorRedirected: boolean
      }
    }
  }
  data: {
    projectId: string
    accountId: string
    revision: string
  }
  visitor_id: {
    [strategy: string]: string
  }
  visitor: {
    visitorId: string
    source_type: string
    referrer: string | null
    first_session: boolean
    device_type: string
    device: string
    browser: string
    browserVersion: string
  }
}

export interface GatedResource {
  user_vuid: string
  data_source_type: string
  data_source: string
  data_source_instance: string
  data_source_version: string
  data_source_details: string | null
  last_modified_at: string
  page_ids: string[]
  _exists: boolean
}

export interface GatedResourceResponse {
  gated_resource: GatedResource | null
  errors: {
    message: string
    locations: { line: number; column: number }[]
    extensions: { classification: string }
  }[]
}

export interface UserIdResponse {
  identifier_field_name: string
  identifier_value: string
  consent: string
  consent_update_reason: string
  consent_update_ts: string
  zaius_id: number
}
export type DataPlatformProfileResponse =
  | {
      data: {
        customers: {
          edges: {
            node: DataPlatformProfile
          }[]
        }
      }
      errors: never
    }
  | {
      data: never
      errors: {
        message: string
        locations: { line: number; column: number }[]
        extensions: { classification: string }
      }[]
    }

export interface DataPlatformProfile {
  active_territory_segment: string
  annual_revenue: string
  b2b_commerce_activation_status: string
  b2b_commerce_default_organization_id: string
  b2b_commerce_id: string
  b2b_commerce_is_guest?: boolean
  b2b_commerce_user_name: string
  ccpa_opted_out: boolean
  city: string
  commerce_cloud_id: string
  company_name: string
  company_phone: string
  content_intelligence_ai_generated_topic_interests: string
  content_intelligence_first_topic: string
  content_intelligence_id: string
  content_intelligence_second_topic: string
  content_intelligence_third_topic: string
  country: string
  country_iso_code: string
  data_source: string
  data_source_details: string
  data_source_instance: string
  data_source_type: string
  data_source_version: string
  delighted_nps_score: number
  dob_day: number
  dob_month: number
  dob_year: number
  domain: string
  email: string
  employee_count: string
  employee_range: string
  first_name: string
  fs_user_id: string
  functional_cookie: boolean
  gated_form_page_ids: string
  gender: string
  high_web_user_id: string
  hubspot_id: string
  image_url: string
  industry: string
  jm_1_id: string
  job_level: string
  job_title: string
  klaviyo_sync_data_hash: string
  last_modified_at: number
  last_name: string
  last_observed_timezone: string
  lead_score: number
  lead_score_nr: number
  lead_score_number: string
  loyalty_is_enrolled_member: boolean
  loyalty_points_balance: number
  loyalty_profile_created_at: string
  loyalty_profile_updated_at: string
  loyalty_referral_code_id: string
  loyalty_tier_id: string
  loyaltylion_loyalty_tier_started_at: string
  low_web_user_id: string
  marketo_app_form_id: string
  marketo_app_form_name_id: string
  marketo_app_lead_id: string
  marketo_app_mkto_cookie_id: string
  marketo_industry: string
  marketo_token: string
  marketing_funnel_stage: string
  name: string
  naics: string
  naics_description: string
  opti_exp_cookie_id: string
  performance_cookie: boolean
  person_score: string
  person_status: string
  phone: string
  persona: string
  product_familiarity: string
  region: string
  revenue_cycle_stage: string
  revenue_range: string
  salesforce_contact_status: string
  salesforce_crm_sync_account_id: string
  salesforce_crm_sync_contact_id: string
  salesforce_crm_sync_is_converted: boolean
  salesforce_crm_sync_is_lead: boolean
  salesforce_crm_sync_lead_id: string
  salesforce_crm_sync_lead_status: string
  salesforce_crm_sync_phone: string
  segment_anonymous_id: string
  segment_user_id: string
  sf_lead_source: string
  sic: string
  sic_description: string
  sixsense_annual_company_revenue: string
  sixsense_annual_revenue: string
  sixsense_city: string
  sixsense_company: string
  sixsense_company_name: string
  sixsense_company_region: string
  sixsense_company_state: string
  sixsense_confidence: string
  sixsense_country: string
  sixsense_domain: string
  sixsense_employee_count: string
  sixsense_employee_range: string
  sixsense_first_name: string
  sixsense_industry: string
  sixsense_job_function: string
  sixsense_job_title: string
  sixsense_last_name: string
  sixsense_naics: string
  sixsense_phone: string
  sixsense_segments: string
  sixsense_sic: string
  sixsense_state: string
  sixsense_vuid_hash_id: string
  sixsense_work_phone: string
  state: string
  state_code: string
  street1: string
  street2: string
  target_ing_cookie: boolean
  timezone: string
  twilio_segment_segment_anonymous_id: string
  twilio_segment_segment_user_id: string
  vuid: string
  web_user_id: string
  wistia_video: string
  wistia_watched_videos: string
  zip: string
}

export interface LastSearchTermsResponse {
  events: {
    edges: EventEdge[]
  }
}

export interface EventEdge {
  node: EventNode
}

export interface EventNode {
  search_term: string | null
}
