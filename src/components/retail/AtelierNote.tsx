/**
 * AtelierNote — magazine spread.
 * Two-column on desktop: image plate (with parallax) + body column with
 * italic title, drop-cap paragraph, and a quiet CTA link.
 */

import SlatePlate from './SlatePlate';
import type { AtelierNoteBlock, RetailRegister } from '../../lib/graph-types';

interface Props {
  block: AtelierNoteBlock;
  register: RetailRegister;
}

export default function AtelierNote({ block, register }: Props) {
  return (
    <section className="retail-atelier">
      <div className="retail-atelier__spread">
        <div className="retail-atelier__plate" data-retail-mask>
          <SlatePlate
            imageUrl={block.imageUrl?.default}
            imageDirection={block.imageDirection || undefined}
            itemName={block.title || 'atelier'}
            register={register}
          />
        </div>

        <div className="retail-atelier__text">
          <span className="retail-atelier__label" data-retail-hairline>
            From the atelier
          </span>

          {block.title && (
            <h2 className="retail-atelier__title" data-retail-reveal>
              {block.title}
            </h2>
          )}

          <p className="retail-atelier__body retail-dropcap" data-retail-reveal data-retail-delay="120">
            {block.body}
          </p>

          {block.cta && (
            <a
              className="retail-link retail-atelier__cta"
              href="mailto:stylist@maisonaurelle.example?subject=Re%3A%20The%20atelier%20note"
              data-retail-reveal
              data-retail-delay="240"
            >
              {block.cta} →
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
