import { useState } from 'react';
import { gravatarUrl } from '../lib/gravatar';

interface Props {
  email?: string | null;
  initials: string;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
}

/**
 * Renders a Gravatar photo if the email has one set, otherwise falls back
 * to the initials circle. Uses ?d=404 to detect missing avatars.
 */
export default function GravatarAvatar({ email, initials, className, style, size = 80 }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const url = email ? gravatarUrl(email, size) : null;

  if (url && !imgFailed) {
    return (
      <div className={className} style={style}>
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }}
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      {initials}
    </div>
  );
}
