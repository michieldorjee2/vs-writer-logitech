/**
 * SmallInvitation — restraint as design.
 * Tiny image plate centered, single italic line, quiet CTA.
 * Most of the section is whitespace.
 */

import SlatePlate from './SlatePlate';
import type { SmallInvitationBlock, RetailRegister } from '../../lib/graph-types';

interface Props {
  block: SmallInvitationBlock;
  register: RetailRegister;
}

export default function SmallInvitation({ block, register }: Props) {
  return (
    <section className="retail-invitation">
      <div className="retail-invitation__inner">
        <div className="retail-invitation__plate" data-retail-mask>
          <SlatePlate
            imageUrl={block.imageUrl?.default}
            imageDirection={block.imageDirection || undefined}
            register={register}
            marker="invitation"
          />
        </div>

        <span className="retail-invitation__name" data-retail-reveal data-retail-delay="120">
          {block.itemName}
        </span>

        <p className="retail-invitation__line" data-retail-reveal data-retail-delay="240">
          {block.line}
        </p>

        {block.cta && (
          <a href="#" className="retail-link" data-retail-reveal data-retail-delay="360">
            {block.cta} →
          </a>
        )}
      </div>
    </section>
  );
}
