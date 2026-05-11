/**
 * WornThisYear — "In your rotation" memory section.
 * Four anchor pieces the customer already owns, with image + name + qualifier + season.
 * Reads from demo content; in production this would query the customer's order history.
 */

import { pickImage } from '../../lib/retail-image-bank';
import type { RetailRegister } from '../../lib/graph-types';
import type { WornAnchor } from '../../lib/retail-demo-content';

interface Props {
  label: string;
  anchors: WornAnchor[];
  register: RetailRegister;
}

export default function WornThisYear({ label, anchors, register }: Props) {
  if (!anchors?.length) return null;
  return (
    <section className="retail-worn" id="rotation" aria-labelledby="rotation-heading">
      <div className="retail-worn__inner">
        <div className="retail-worn__head">
          <span className="retail-label-gold" data-retail-hairline>{label}</span>
          <h2 id="rotation-heading" className="retail-worn__heading">
            Pieces in the rotation
          </h2>
          <p className="retail-worn__lede">
            What you've worn this year. The picks below are chosen so they read alongside, not against.
          </p>
        </div>

        <ul className="retail-worn__grid">
          {anchors.map((a, i) => {
            const img = pickImage(a.name, a.qualifier, register);
            return (
              <li key={i} className="retail-worn__item" data-retail-reveal data-retail-delay={`${i * 80}`}>
                <div
                  className="retail-worn__plate"
                  role="img"
                  aria-label={`${a.name}, ${a.qualifier}`}
                  style={{ backgroundImage: `url(${img.url})` }}
                />
                <div className="retail-worn__caption">
                  <span className="retail-worn__name">{a.name}</span>
                  <span className="retail-worn__qualifier">{a.qualifier}</span>
                  <span className="retail-worn__season">{a.season}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
