/** SHIM (ours): next/link -> <a>. Every link on these pages is a full navigation. */
import type { AnchorHTMLAttributes } from 'react'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string | { pathname?: string }
  prefetch?: boolean
  scroll?: boolean
  replace?: boolean
}

export default function Link({ href, prefetch: _p, scroll: _s, replace: _r, ...rest }: Props) {
  return <a href={typeof href === 'string' ? href : (href.pathname ?? '/')} {...rest} />
}
