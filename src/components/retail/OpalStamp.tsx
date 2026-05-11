/**
 * OpalStamp — circular wax-stamp-feeling mark.
 * Pure SVG. Used on the letter corner, the lightbox header, and anywhere
 * the page wants to signal "this came from Opal."
 *
 * Layered:
 *   - circular gold ring with subtle inner shadow
 *   - "OPAL" set in small caps with a curved baseline
 *   - center motif: two overlapping arcs (an abstract opal facet) in gold
 */

import type { CSSProperties } from 'react';

interface Props {
  size?: number;
  /** Optional className to control transform / position from the parent. */
  className?: string;
  style?: CSSProperties;
  /** Hide from screen readers when used as pure decoration alongside text. */
  decorative?: boolean;
}

export default function OpalStamp({ size = 96, className, style, decorative = true }: Props) {
  const id = 'opal-stamp-' + Math.random().toString(36).slice(2, 8);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={className}
      style={style}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'Opal'}
    >
      <defs>
        <radialGradient id={`${id}-paper`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbf6e8" stopOpacity="0" />
          <stop offset="80%" stopColor="#7b5f3c" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#7b5f3c" stopOpacity="0.18" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d3b07e" />
          <stop offset="50%" stopColor="#b89968" />
          <stop offset="100%" stopColor="#8c7044" />
        </linearGradient>
        <path
          id={`${id}-circle-top`}
          d="M 18 48 A 30 30 0 0 1 78 48"
          fill="none"
        />
        <path
          id={`${id}-circle-bottom`}
          d="M 18 48 A 30 30 0 0 0 78 48"
          fill="none"
        />
      </defs>

      {/* Background bleed — subtle ink halo */}
      <circle cx="48" cy="48" r="46" fill={`url(#${id}-paper)`} />

      {/* Outer ring */}
      <circle
        cx="48"
        cy="48"
        r="34"
        fill="none"
        stroke={`url(#${id}-gold)`}
        strokeWidth="1.3"
        opacity="0.9"
      />
      <circle
        cx="48"
        cy="48"
        r="30"
        fill="none"
        stroke={`url(#${id}-gold)`}
        strokeWidth="0.6"
        opacity="0.6"
      />

      {/* Top arc text — MAISON AURELLE */}
      <text
        fill="#7b5f3c"
        opacity="0.88"
        fontSize="5.2"
        fontFamily="'Iowan Old Style', 'Apple Garamond', 'Charter', Georgia, serif"
        fontStyle="italic"
        letterSpacing="2.4"
      >
        <textPath href={`#${id}-circle-top`} startOffset="50%" textAnchor="middle">
          MAISON AURELLE
        </textPath>
      </text>

      {/* Bottom arc text — PAR OPAL */}
      <text
        fill="#7b5f3c"
        opacity="0.85"
        fontSize="4.6"
        fontFamily="-apple-system, 'Inter', sans-serif"
        letterSpacing="2.8"
      >
        <textPath href={`#${id}-circle-bottom`} startOffset="50%" textAnchor="middle">
          ✦ PAR OPAL ✦
        </textPath>
      </text>

      {/* Center motif — Opal facet */}
      <g transform="translate(48 50)" opacity="0.94">
        {/* Diamond/facet outline */}
        <path
          d="M 0 -10 L 9 0 L 0 10 L -9 0 Z"
          fill="none"
          stroke={`url(#${id}-gold)`}
          strokeWidth="1.3"
        />
        {/* Cross facet lines */}
        <path
          d="M -9 0 L 9 0 M 0 -10 L 0 10 M -4.5 -5 L 4.5 -5 M -4.5 5 L 4.5 5"
          stroke={`url(#${id}-gold)`}
          strokeWidth="0.7"
          opacity="0.7"
        />
        {/* Center dot */}
        <circle cx="0" cy="0" r="1.3" fill="#b89968" />
      </g>
    </svg>
  );
}
