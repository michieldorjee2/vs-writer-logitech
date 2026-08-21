/**
 * WornThisYear — editorial spread. One full-width band per anchor:
 *
 *   Left (alternating): big duotone photograph of the piece the customer
 *   already owns, an italic "Worn since [season]" eyebrow, a drop-cap
 *   body paragraph describing how the piece has been worn.
 *
 *   Right: a smaller, fully-colored photograph of the new piece that
 *   pairs with it; "Pair with" gold label; name, qualifier, price label;
 *   Add to bag / Save buttons that write to the live cart.
 *
 *   Between owned and paired: a gold hairline, a small monogram, the
 *   word "and" italicised.
 *
 *   Each band alternates the photo side (band 0: image left, band 1:
 *   image right, …) for editorial rhythm.
 *
 * Animations: photographs reveal on scroll with a slight scale; copy
 * reveals line by line. The paired image scales up subtly on hover.
 */

import { pickImage } from '../../lib/retail-image-bank';
import { resolveUrl, type RetailRegister, type RetailWornAnchor } from '../../lib/graph-types';
import { useCart, originFromEvent, slugifyName } from '../../lib/retail-cart';
import OpalStamp from './OpalStamp';

interface Props {
  label?: string | null;
  anchors: RetailWornAnchor[];
  register: RetailRegister;
}

export default function WornThisYear({ label, anchors, register }: Props) {
  const { addToCart, saveForLater } = useCart();
  if (!anchors?.length) return null;

  return (
    <section className="retail-rotation" id="rotation" aria-labelledby="rotation-heading">
      <header className="retail-rotation__head">
        {label && (
          <span className="retail-rotation__eyebrow" data-retail-hairline>
            {label}
          </span>
        )}
        <h2 id="rotation-heading" className="retail-rotation__heading">
          The pieces you wear, paired
        </h2>
        <p className="retail-rotation__lede">
          Three things from your closet, each set against a new piece that reads alongside —
          not against. A second register of the same wardrobe.
        </p>
      </header>

      <div className="retail-rotation__bands">
        {anchors.slice(0, 3).map((a, i) => {
          const flip = i % 2 === 1; // alternate image side
          const ownedUrl = resolveUrl(a.ownedImageUrl) || pickImage(a.name, a.qualifier || '', register).url;
          const hasPaired = Boolean(a.pairedName);
          const pairedUrl = hasPaired
            ? resolveUrl(a.pairedImageUrl) || pickImage(a.pairedName as string, a.pairedQualifier || '', register).url
            : null;
          return (
            <article
              key={i}
              className={`retail-rotation__band${flip ? ' retail-rotation__band--flip' : ''}`}
              data-retail-reveal
              data-retail-delay={`${i * 120}`}
            >
              {/* Editorial caption — index numeral + label */}
              <div className="retail-rotation__numeral" aria-hidden="true">
                <span className="retail-rotation__no">N° {String(i + 1).padStart(2, '0')}</span>
                <span className="retail-rotation__divider" />
              </div>

              <div className="retail-rotation__owned">
                <figure className="retail-rotation__owned-figure">
                  <div
                    className="retail-rotation__owned-photo"
                    role="img"
                    aria-label={a.name + (a.qualifier ? `, ${a.qualifier}` : '')}
                    style={{ backgroundImage: `url(${ownedUrl})` }}
                  />
                  <figcaption className="retail-rotation__owned-cap">
                    <span className="retail-rotation__owned-pin" aria-hidden="true" />
                    <span className="retail-rotation__owned-tag">In your closet</span>
                    {a.season && <span className="retail-rotation__owned-since">Worn since {a.season}</span>}
                  </figcaption>
                </figure>
              </div>

              <div className="retail-rotation__copy">
                <span className="retail-rotation__copy-eyebrow">Anchor</span>
                <h3 className="retail-rotation__copy-name">{a.name}</h3>
                {a.qualifier && (
                  <span className="retail-rotation__copy-qualifier">{a.qualifier}</span>
                )}
                <p className="retail-rotation__copy-body retail-dropcap">
                  {pairedNote(a)}
                </p>

                {/* Hairline divider with monogram between owned + paired */}
                <div className="retail-rotation__rule" aria-hidden="true">
                  <span className="retail-rotation__rule-line" />
                  <OpalStamp size={42} className="retail-rotation__rule-stamp" />
                  <span className="retail-rotation__rule-line" />
                </div>
                <span className="retail-rotation__pair-eyebrow">Pair with</span>

                {hasPaired && pairedUrl && (
                  <div className="retail-rotation__paired">
                    <figure className="retail-rotation__paired-figure">
                      <div
                        className="retail-rotation__paired-photo"
                        role="img"
                        aria-label={a.pairedName + (a.pairedQualifier ? `, ${a.pairedQualifier}` : '')}
                        style={{ backgroundImage: `url(${pairedUrl})` }}
                      />
                    </figure>
                    <div className="retail-rotation__paired-meta">
                      <h4 className="retail-rotation__paired-name">{a.pairedName}</h4>
                      {a.pairedQualifier && (
                        <span className="retail-rotation__paired-qualifier">{a.pairedQualifier}</span>
                      )}
                      {a.pairedPriceLabel && (
                        <span className="retail-rotation__paired-price">{a.pairedPriceLabel}</span>
                      )}
                      <div className="retail-rotation__paired-actions">
                        <button
                          type="button"
                          className="retail-rotation__btn"
                          onClick={(e) => addToCart({
                            id: `pair-${slugifyName(a.pairedName as string)}`,
                            name: a.pairedName as string,
                            qualifier: a.pairedQualifier || null,
                            imageUrl: pairedUrl,
                            priceLabel: a.pairedPriceLabel || null,
                            qty: 1,
                            source: 'pair',
                            note: `Pairs with the ${a.name} already in your closet.`,
                          }, originFromEvent(e, pairedUrl))}
                        >
                          Add to bag
                        </button>
                        <button
                          type="button"
                          className="retail-rotation__btn retail-rotation__btn--quiet"
                          onClick={() => saveForLater({
                            id: `pair-${slugifyName(a.pairedName as string)}`,
                            name: a.pairedName as string,
                            qualifier: a.pairedQualifier || null,
                            imageUrl: pairedUrl,
                            priceLabel: a.pairedPriceLabel || null,
                            note: `Paired with the ${a.name}.`,
                          })}
                          aria-label={`Save ${a.pairedName} for next visit`}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Generate a short editorial body line about the anchor + its pairing,
 * using whatever qualifier/seasonal context we have. Keeps the prose
 * voicey when CMS doesn't supply a dedicated note. */
function pairedNote(a: RetailWornAnchor): string {
  const since = a.season ? ` Worn since ${a.season}.` : '';
  const qualifier = a.qualifier ? ` — ${a.qualifier}.` : '.';
  const pairedLine = a.pairedName
    ? ` This season, the ${a.pairedName.toLowerCase()} reads alongside it — not against it.`
    : '';
  return `The ${a.name.toLowerCase()}${qualifier}${since}${pairedLine}`;
}
