/**
 * SlatePlate — image-first plate for a section.
 * If the CMS provides `imageUrl`, that wins. Otherwise we use the
 * curated retail-image-bank to pick a real photograph keyed by the item
 * name + image-direction text. Falls back to a register-appropriate
 * default still if nothing matches.
 *
 * The previous "designed-slate-placeholder with corner film slate marker"
 * has been retired in favor of real images.
 */

import { useMemo } from 'react';
import type { RetailRegister } from '../../lib/graph-types';
import { pickImage } from '../../lib/retail-image-bank';

interface Props {
  imageUrl?: string | null;
  imageDirection?: string | null;
  /** Item name (or section name) used to score against the image bank. */
  itemName?: string | null;
  register: RetailRegister;
  className?: string;
  ariaHidden?: boolean;
}

export default function SlatePlate({
  imageUrl,
  imageDirection,
  itemName,
  register,
  className,
  ariaHidden = false,
}: Props) {
  const picked = useMemo(
    () => (imageUrl ? { url: imageUrl, alt: '' } : pickImage(itemName || '', imageDirection, register)),
    [imageUrl, itemName, imageDirection, register]
  );

  return (
    <div
      className={`retail-slate${className ? ` ${className}` : ''}`}
      style={{
        backgroundImage: `url(${picked.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      role={ariaHidden ? undefined : 'img'}
      aria-label={ariaHidden ? undefined : (picked.alt || imageDirection || itemName || 'Maison Aurelle')}
      aria-hidden={ariaHidden || undefined}
    >
      <div className="retail-slate__tint" aria-hidden="true" />
    </div>
  );
}
