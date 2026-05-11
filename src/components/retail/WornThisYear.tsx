/**
 * WornThisYear — "In your rotation" pairings.
 *
 * Each card shows an owned anchor piece paired with a new suggestion that
 * accessorizes it. Three cards per row on desktop (down from four), each
 * card a horizontal owned + paired layout connected by a "+" hairline.
 *
 * The "Add to bag" button on the paired side is a demo interaction —
 * toasts a "demo only" message when clicked.
 */

import { pickImage } from '../../lib/retail-image-bank';
import type { RetailRegister } from '../../lib/graph-types';
import type { WornAnchor } from '../../lib/retail-demo-content';

interface Props {
  label: string;
  anchors: WornAnchor[];
  register: RetailRegister;
  /** Called when the paired suggestion's CTA is clicked. */
  onAddToBag?: (anchor: WornAnchor) => void;
}

export default function WornThisYear({ label, anchors, register, onAddToBag }: Props) {
  if (!anchors?.length) return null;
  return (
    <section className="retail-worn" id="rotation" aria-labelledby="rotation-heading">
      <div className="retail-worn__inner">
        <div className="retail-worn__head">
          <span className="retail-label-gold" data-retail-hairline>{label}</span>
          <h2 id="rotation-heading" className="retail-worn__heading">
            Pieces in the rotation, paired
          </h2>
          <p className="retail-worn__lede">
            Three things you already own, each with a new piece that reads alongside —
            not against. Tap a pairing to see how it sits.
          </p>
        </div>

        <ul className="retail-worn__grid">
          {anchors.slice(0, 3).map((a, i) => {
            const ownedImg = pickImage(a.name, a.qualifier, register);
            const paired = a.pairedWith;
            const pairedImg = paired ? pickImage(paired.name, paired.qualifier, register) : null;
            return (
              <li key={i} className="retail-worn__card" data-retail-reveal data-retail-delay={`${i * 100}`}>
                <div className="retail-worn__pair">
                  {/* Owned side */}
                  <div className="retail-worn__half retail-worn__half--owned">
                    <div
                      className="retail-worn__plate"
                      role="img"
                      aria-label={`${a.name}, ${a.qualifier}`}
                      style={{ backgroundImage: `url(${ownedImg.url})` }}
                    />
                    <div className="retail-worn__caption">
                      <span className="retail-worn__tag">In your closet</span>
                      <span className="retail-worn__name">{a.name}</span>
                      <span className="retail-worn__qualifier">{a.qualifier}</span>
                      <span className="retail-worn__season">{a.season}</span>
                    </div>
                  </div>

                  {/* Plus rule */}
                  <div className="retail-worn__plus" aria-hidden="true">
                    <span className="retail-worn__plus-line" />
                    <span className="retail-worn__plus-mark">+</span>
                    <span className="retail-worn__plus-line" />
                  </div>

                  {/* Paired side */}
                  {paired && pairedImg && (
                    <div className="retail-worn__half retail-worn__half--paired">
                      <div
                        className="retail-worn__plate"
                        role="img"
                        aria-label={`${paired.name}, ${paired.qualifier}`}
                        style={{ backgroundImage: `url(${pairedImg.url})` }}
                      />
                      <div className="retail-worn__caption">
                        <span className="retail-worn__tag retail-worn__tag--gold">Pair with</span>
                        <span className="retail-worn__name">{paired.name}</span>
                        <span className="retail-worn__qualifier">{paired.qualifier}</span>
                        <button
                          type="button"
                          className="retail-worn__cta"
                          onClick={() => onAddToBag?.(a)}
                        >
                          Add to bag
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {paired && (
                  <p className="retail-worn__note">{paired.note}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
