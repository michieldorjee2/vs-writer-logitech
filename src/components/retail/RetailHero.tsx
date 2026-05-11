/**
 * RetailHero — full-bleed cinematic hero with personal address.
 *
 * v3: lead with a handwritten monogram ("For I.C. — Tribeca, May MMXXVI")
 * and a stylist byline. The hero copy references actual pieces in the
 * customer's wardrobe. The first impression is "this was written for me"
 * — not "here's a product."
 */

import SlatePlate from './SlatePlate';
import type { RetailHeroBlock, RetailRegister } from '../../lib/graph-types';

interface Props {
  block: RetailHeroBlock;
  monthStamp?: string | null;
  register: RetailRegister;
  /** Personal monogram — typically initials ("I.C."). */
  initials?: string | null;
  /** Neighborhood / district displayed alongside the monogram. */
  neighborhood?: string | null;
  /** Stylist name for the byline. Falls back to "the atelier". */
  stylistName?: string | null;
  /** Stylist boutique location, shown after the name. */
  stylistBoutique?: string | null;
  /** Override for the first line of hero copy. */
  personalLine1?: string | null;
  /** Override for the second line of hero copy. */
  personalLine2?: string | null;
}

/** Render "May MMXXVI" style date from monthStamp ("Curated for May"). */
function formatRomanDate(monthStamp: string | null | undefined): string {
  if (!monthStamp) return 'May MMXXVI';
  const match = monthStamp.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i);
  const m = match ? match[1] : 'May';
  // Hardcoded year for the demo
  return `${m.charAt(0).toUpperCase()}${m.slice(1).toLowerCase()} MMXXVI`;
}

export default function RetailHero({
  block,
  monthStamp,
  register,
  initials,
  neighborhood,
  stylistName,
  stylistBoutique,
  personalLine1,
  personalLine2,
}: Props) {
  const line1 = personalLine1 || block.line1 || '';
  const line2 = personalLine2 || block.line2 || '';
  const words = line1.split(/\s+/);
  const romanDate = formatRomanDate(monthStamp);
  const bylineStylist = stylistName ? `Composed by ${stylistName}` : 'Composed by the atelier';
  const bylineLocation = stylistBoutique || 'Maison Aurelle';

  return (
    <section className="retail-hero">
      <div className="retail-hero__slate">
        <SlatePlate
          imageUrl={block.imageUrl?.default}
          imageDirection={block.imageDirection || undefined}
          itemName={`coat hanging in window light ${line1}`}
          register={register}
        />
      </div>

      <div className="retail-hero__veil" />

      {/* Personal monogram — top-left, like the addressee line on an envelope */}
      {initials && (
        <div className="retail-hero__monogram-box" aria-label="Addressed to you">
          <div className="retail-hero__monogram-row">
            <span className="retail-hero__monogram-for">For</span>
            <span className="retail-hero__monogram-initials">{initials}</span>
          </div>
          {neighborhood && (
            <span className="retail-hero__monogram-where">{neighborhood}</span>
          )}
          <span className="retail-hero__monogram-rule-h" />
          <span className="retail-hero__monogram-date">{romanDate}</span>
        </div>
      )}

      <div className="retail-hero__content">
        <div className="retail-hero__meta">
          <span className="retail-hero__monogram">Maison Aurelle</span>
          <span className="retail-hero__monogram-rule" />
          <span className="retail-hero__monogram-stamp">{romanDate}</span>
        </div>

        <h1 className="retail-hero__title" aria-label={line1}>
          {words.map((word, i) => (
            <span
              key={i}
              className="word-wrap"
              style={{ '--word-delay': `${250 + i * 90}ms` } as React.CSSProperties}
            >
              <span className="word">{word}</span>
              {i < words.length - 1 ? <span className="word-gap">&nbsp;</span> : null}
            </span>
          ))}
        </h1>

        {line2 && <p className="retail-hero__line2">{line2}</p>}

        {/* Stylist byline — italic, below the main copy */}
        <p className="retail-hero__byline">
          <span className="retail-hero__byline-script">{bylineStylist}</span>
          {bylineLocation && (
            <>
              <span className="retail-hero__byline-dot" aria-hidden="true">·</span>
              <span className="retail-hero__byline-loc">{bylineLocation}</span>
            </>
          )}
        </p>
      </div>

      <div className="retail-hero__scrollhint" aria-hidden="true">
        <span>read on</span>
      </div>
    </section>
  );
}
