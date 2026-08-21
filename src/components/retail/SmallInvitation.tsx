/**
 * SmallInvitation — restraint as design.
 * Tiny image plate centered, single italic line, quiet CTA.
 * Most of the section is whitespace.
 */

import SlatePlate from './SlatePlate';
import type { SmallInvitationBlock, RetailRegister } from '../../lib/graph-types';
import { useCart, slugifyName } from '../../lib/retail-cart';

interface Props {
  block: SmallInvitationBlock;
  register: RetailRegister;
}

export default function SmallInvitation({ block, register }: Props) {
  const { saveForLater } = useCart();
  return (
    <section className="retail-invitation">
      <div className="retail-invitation__inner">
        <div className="retail-invitation__plate" data-retail-mask>
          <SlatePlate
            imageUrl={(block.itemImageUrl?.default ?? block.imageUrl?.default) || null}
            imageDirection={block.imageDirection || undefined}
            itemName={block.itemName}
            register={register}
          />
        </div>

        <span className="retail-invitation__name" data-retail-reveal data-retail-delay="120">
          {block.itemName}
        </span>

        <p className="retail-invitation__line" data-retail-reveal data-retail-delay="240">
          {block.line}
        </p>

        {block.cta && (
          <button
            type="button"
            className="retail-link"
            onClick={() => saveForLater({
              id: `invitation-${slugifyName(block.itemName)}`,
              name: block.itemName,
              qualifier: null,
              imageUrl: (block.itemImageUrl?.default ?? block.imageUrl?.default) || null,
              priceLabel: null,
              note: 'Set out for your next visit at the atelier.',
            })}
            data-retail-reveal
            data-retail-delay="360"
          >
            {block.cta} →
          </button>
        )}
      </div>
    </section>
  );
}
