import { useEffect, useRef, useState } from 'react';
import { avatarSources, type OthersGet } from '../lib/page-photos';

interface Props {
  email?: string | null;
  initials: string;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
  /**
   * What an address that is not Optimizely's is drawn with: its Gravatar (the cards that always
   * did), or only initials (the cards that never asked Gravatar for anyone: a customer's address is
   * not sent there for the first time because a card learned to draw photos).
   */
  others?: OthersGet;
}

/**
 * A person's photo, or their initials. Gravatar first; when it has none (`?d=404`), someone from
 * Optimizely's Microsoft Teams photo, asked of this site's own /api/page-photo for the page the
 * visitor is on (src/lib/page-photos.ts); when that has none either, the initials. Each step is
 * the browser's own `error` on an <img>, so drawing never waits on a photo and a failed one is
 * the initials, exactly as a missing Gravatar always was.
 *
 * The server draws only the first step, so the markup the browser hydrates is the markup the
 * server sent: the Teams step needs the page's address and exists only once Gravatar has failed.
 */
export default function GravatarAvatar({ email, initials, className, style, size = 80, others = 'gravatar' }: Props) {
  const [stage, setStage] = useState(0);
  const sources = avatarSources(email, {
    size,
    pathname: typeof window === 'undefined' ? null : window.location.pathname,
    others,
  });
  const source = sources[stage];
  const imgRef = useRef<HTMLImageElement | null>(null);
  // From this step to the next, once: the error event and the check below can both see the same failure.
  const next = () => setStage((s) => (s === stage ? s + 1 : s));

  // A photo that failed before the page was interactive left no event for React to hear: a broken
  // image is `complete` with no width. (One still on its way is not complete, lazy or not.)
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `next` is this step's own, and the step is the dependency
  }, [stage]);

  if (source) {
    return (
      <div className={className} style={style} aria-hidden="true">
        {/* Lazy: the team rows sit far down the page, and an eager <img> in a server render becomes a
            high-priority <link rel="preload"> (React 19) to a third origin, ahead of the hero image. */}
        <img
          key={source.url}
          ref={imgRef}
          src={source.url}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }}
          onError={next}
        />
      </div>
    );
  }

  return (
    <div className={className} style={style} aria-hidden="true">
      {initials}
    </div>
  );
}
