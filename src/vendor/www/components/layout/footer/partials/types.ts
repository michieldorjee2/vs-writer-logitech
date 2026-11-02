// Locally-defined prop types for footer partials. Mirror the shape of the
// FooterFragment selection on the parent.

export interface FooterLinkProps {
  label?: string | null
  href?: string | null
}

export interface FooterColumnProps {
  title?: string | null
  links?: FooterLinkProps[]
}

export interface PromoCardProps {
  badge?: string
  title?: string
  href?: string
}

export interface NavigationColumnsProps {
  columns?: FooterColumnProps[]
  promoCard?: React.ReactNode
}

export interface BottomBarProps {
  copyrightText?: string
  legalLinks?: FooterLinkProps[]
  searchLabel?: string
  searchHref?: string
  currentLocale?: string
}

export interface FooterProps {
  columns?: FooterColumnProps[]
  copyrightText?: string
  legalLinks?: FooterLinkProps[]
  searchLabel?: string
  searchHref?: string
  promoCard?: PromoCardProps
  showWordmark?: boolean
  currentLocale?: string
}
