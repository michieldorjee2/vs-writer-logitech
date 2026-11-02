/**
 * SHIM (ours): next/image -> a plain <img>. Showcase has no Next image optimizer; the CMP DAM
 * and Brandfetch URLs these components receive are already sized.
 */
import type { ImgHTMLAttributes } from 'react'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | { src: string }
  fill?: boolean
  priority?: boolean
  quality?: number
  unoptimized?: boolean
  sizes?: string
}

export default function Image({ src, fill, priority, quality: _q, unoptimized: _u, style, ...rest }: Props) {
  const url = typeof src === 'string' ? src : src.src
  return (
    <img
      src={url}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style}
      {...rest}
    />
  )
}
