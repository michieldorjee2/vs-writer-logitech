import type { ReactElement } from 'react';

/* ============================================================
   X-ray tool icons — small monochrome glyphs rendered next to
   each tool name in the annotation cards. All use currentColor
   so they pick up the chip's text colour.

   Names match the canonical strings in xray-defaults.ts:
     'Salesforce', 'BuiltWith', 'Opal', 'ODP', 'CMS',
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

const Opal = ({ size }: IconProps) => (
  <Wrap size={size}>
    <path d="M8 2 L13 6 L13 10 L8 14 L3 10 L3 6 Z" />
    <path d="M5 7l3 4 3-4" strokeWidth="1" opacity="0.6" />
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
  'Opal': Opal,
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
