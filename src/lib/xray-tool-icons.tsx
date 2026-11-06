import { useState, type ReactElement } from 'react';
import { brandLogoTypeUrl } from './brand-logo';

/* ============================================================
   X-ray tool icons. XrayToolLogo is what the cards show: each
   tool's own colour logo (Brandfetch's icon for the company,
   Optimizely's mark for our own products, a lime spark on Dark
   Fir for Mark). The small monochrome glyphs below are its
   fallback when a logo does not load, and the icon for tools
   that are not a company (Web browsing, Sitemap), drawn in a
   colour of their own.

   Names match the canonical strings in xray-defaults.ts:
     'Salesforce', 'BuiltWith', 'Mark', 'ODP', 'CMS',
     'Web browsing', 'Sitemap', 'LinkedIn', '6sense',
     'Gravatar', 'Brandfetch'
   ============================================================ */

interface IconProps {
  size?: number;
}

function Wrap({ children, size = 12 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const Salesforce = ({ size }: IconProps) => (
  <Wrap size={size}>
    <path d="M5.5 11.5a2.5 2.5 0 0 1-.5-4.95A3.5 3.5 0 0 1 11.6 5.5a2.5 2.5 0 0 1 .9 4.95" />
    <path d="M4.8 11.5h6.4" />
  </Wrap>
);

const BuiltWith = ({ size }: IconProps) => (
  <Wrap size={size}>
    <rect x="2.5" y="3" width="11" height="2.6" rx="0.4" />
    <rect x="2.5" y="6.7" width="11" height="2.6" rx="0.4" />
    <rect x="2.5" y="10.4" width="11" height="2.6" rx="0.4" />
  </Wrap>
);

const Mark = ({ size }: IconProps) => (
  // four-point spark with a small companion spark
  <Wrap size={size}>
    <path d="M7 2.5 L8.4 6.6 L12.5 8 L8.4 9.4 L7 13.5 L5.6 9.4 L1.5 8 L5.6 6.6 Z" />
    <path d="M12.5 2v3M11 3.5h3" strokeWidth="1.1" opacity="0.7" />
  </Wrap>
);

const ODP = ({ size }: IconProps) => (
  // bar chart with up arrow
  <Wrap size={size}>
    <path d="M3 13v-3.5" />
    <path d="M7 13v-6" />
    <path d="M11 13v-2" />
    <path d="M3 13l6-7 4 3 0 0" strokeWidth="1.2" opacity="0.7" />
    <path d="M11 6l2-2-2-1" />
  </Wrap>
);

const CMS = ({ size }: IconProps) => (
  // stacked documents
  <Wrap size={size}>
    <rect x="3.5" y="2.5" width="9" height="11" rx="1" />
    <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" strokeWidth="1.1" />
  </Wrap>
);

const WebBrowsing = ({ size }: IconProps) => (
  <Wrap size={size}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M2.5 8h11" />
    <path d="M8 2.5c1.8 1.4 2.7 3.4 2.7 5.5s-0.9 4.1-2.7 5.5c-1.8-1.4-2.7-3.4-2.7-5.5s0.9-4.1 2.7-5.5z" />
  </Wrap>
);

const Sitemap = ({ size }: IconProps) => (
  <Wrap size={size}>
    <rect x="6" y="2" width="4" height="3" rx="0.5" />
    <rect x="2" y="11" width="4" height="3" rx="0.5" />
    <rect x="10" y="11" width="4" height="3" rx="0.5" />
    <path d="M8 5v3" />
    <path d="M4 11V8h8v3" />
  </Wrap>
);

const LinkedIn = ({ size }: IconProps) => (
  // abstract: dot + bar + curve
  <Wrap size={size}>
    <circle cx="3.5" cy="3.5" r="1.3" fill="currentColor" stroke="none" />
    <rect x="2.2" y="6.5" width="2.6" height="7" rx="0.3" fill="currentColor" stroke="none" />
    <rect x="6.5" y="6.5" width="2.6" height="7" rx="0.3" fill="currentColor" stroke="none" />
    <path d="M9.1 9.5c0-2.2 4.4-2.2 4.4 0v4" />
  </Wrap>
);

const SixSense = ({ size }: IconProps) => (
  // concentric arcs / radar
  <Wrap size={size}>
    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    <path d="M5.2 8a2.8 2.8 0 0 1 5.6 0" />
    <path d="M3 8a5 5 0 0 1 10 0" />
  </Wrap>
);

const Gravatar = ({ size }: IconProps) => (
  // avatar silhouette
  <Wrap size={size}>
    <circle cx="8" cy="6" r="2.6" />
    <path d="M3.5 13.5a4.5 4.5 0 0 1 9 0" />
  </Wrap>
);

const Brandfetch = ({ size }: IconProps) => (
  // three overlapping color swatches
  <Wrap size={size}>
    <circle cx="5.5" cy="6.5" r="2.7" />
    <circle cx="10.5" cy="6.5" r="2.7" />
    <circle cx="8" cy="11" r="2.7" />
  </Wrap>
);

const ICONS: Record<string, (p: IconProps) => ReactElement> = {
  'Salesforce': Salesforce,
  'BuiltWith': BuiltWith,
  'Mark': Mark,
  'ODP': ODP,
  'CMS': CMS,
  'Web browsing': WebBrowsing,
  'Sitemap': Sitemap,
  'LinkedIn': LinkedIn,
  '6sense': SixSense,
  'Gravatar': Gravatar,
  'Brandfetch': Brandfetch,
};

/** Render the icon for a named tool. Returns null if the name doesn't
 *  match a known tool, so unknown strings just show without an icon. */
export function XrayToolIcon({ name, size = 12 }: { name: string; size?: number }) {
  const Icon = ICONS[name];
  if (!Icon) return null;
  return <Icon size={size} />;
}

/** The company behind each tool, for its logo (Brandfetch's icon for the domain). */
const TOOL_DOMAINS: Record<string, string> = {
  'Salesforce': 'salesforce.com',
  'BuiltWith': 'builtwith.com',
  'LinkedIn': 'linkedin.com',
  '6sense': '6sense.com',
  'Gravatar': 'gravatar.com',
  'Brandfetch': 'brandfetch.com',
};
/** Our own products: Optimizely's mark (public/favicon.svg). */
const OPTIMIZELY_TOOLS = new Set(['ODP', 'CMS']);
/** Tools that are not a company: their glyph, in a colour of its own. */
const GLYPH_COLOURS: Record<string, string> = {
  'Web browsing': '#2f7de1',
  'Sitemap': '#e08a1e',
};

/** Mark: a lime spark on Dark Fir, the agent's colours. */
function MarkLogo({ size }: { size: number }) {
  return (
    <svg className="xray-tool-logo" viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false">
      <rect width="20" height="20" rx="5" fill="#08251a" />
      <path d="M9 3.5l1.6 4.4 4.4 1.6-4.4 1.6L9 15.5l-1.6-4.4L3 9.5l4.4-1.6z" fill="#abff44" />
      <path d="M15.2 3v3M13.7 4.5h3" stroke="#abff44" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A tool's colour logo for the X-ray cards. Falls back to its monochrome glyph when the logo does
 * not load (Brandfetch answers in a browser only, by the page's address), and to nothing for a
 * name it does not know.
 */
export function XrayToolLogo({ name, size = 18 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (name === 'Mark') return <MarkLogo size={size} />;
  const src = OPTIMIZELY_TOOLS.has(name) ? '/favicon.svg' : TOOL_DOMAINS[name] ? brandLogoTypeUrl(TOOL_DOMAINS[name], 'icon') : null;
  if (src && !failed) {
    return <img className="xray-tool-logo" src={src} width={size} height={size} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
  }
  if (!ICONS[name]) return null;
  return (
    <span className="xray-tool-logo xray-tool-logo--glyph" style={{ width: size, height: size, color: GLYPH_COLOURS[name] }} aria-hidden="true">
      <XrayToolIcon name={name} size={Math.round(size * 0.78)} />
    </span>
  );
}
