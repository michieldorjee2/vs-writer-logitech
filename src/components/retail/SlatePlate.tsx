/**
 * SlatePlate — the agent-generated content references `imageDirection` strings
 * (one-sentence briefs for the design team) rather than real photography.
 * Until real images land, we treat that brief AS the design: a full-bleed
 * monochrome plate with the direction shown small in the corner, like a
 * film slate. When `imageUrl` is provided the real image takes over.
 *
 * Tone varies by register so the plate doesn't look like five identical placeholders.
 */

import type { RetailRegister } from '../../lib/graph-types';

const TONE_BY_REGISTER: Record<RetailRegister, string> = {
  minimal:   'linear-gradient(155deg, #2a2622 0%, #1a1614 100%)',
  archive:   'linear-gradient(155deg, #2c2520 0%, #1a1612 100%)',
  discovery: 'linear-gradient(155deg, #2e2620 0%, #1c1410 100%)',
  atelier:   'linear-gradient(155deg, #232425 0%, #15161a 100%)',
  family:    'linear-gradient(155deg, #2c2823 0%, #1a1714 100%)',
};

interface Props {
  imageUrl?: string | null;
  imageDirection?: string | null;
  register: RetailRegister;
  /** Optional small caps label shown in top corner (e.g. "01" or "Hero") */
  marker?: string;
  className?: string;
  ariaHidden?: boolean;
}

export default function SlatePlate({
  imageUrl,
  imageDirection,
  register,
  marker,
  className,
  ariaHidden = true,
}: Props) {
  const style: React.CSSProperties = imageUrl
    ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: TONE_BY_REGISTER[register] };

  return (
    <div className={`retail-slate${className ? ` ${className}` : ''}`} style={style} aria-hidden={ariaHidden}>
      {!imageUrl && (
        <>
          {/* Subtle film-stock grain */}
          <div className="retail-slate__grain" aria-hidden="true" />
          <div className="retail-slate__crosshair" aria-hidden="true">
            <span className="retail-slate__cross" />
            <span className="retail-slate__cross retail-slate__cross--v" />
          </div>
          {marker && <span className="retail-slate__marker">{marker}</span>}
          {imageDirection && (
            <span className="retail-slate__direction">{imageDirection}</span>
          )}
        </>
      )}
    </div>
  );
}
