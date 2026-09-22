/**
 * Image Display — the Vite/URL form of upstream `components/block/image-display-block`.
 *
 * DIVERGENCE.md explains why this element carries a plain `ImageUrl` instead of upstream's
 * `ImageReference`: a content reference is a 400 on an `elementEnabled` type. The renderer
 * inherits the consequence. Upstream hands `next/image` the asset's real intrinsic width and
 * height; we have neither, and there is no `next/image` here, so the image is sized purely
 * from CSS. `block h-auto w-full` is exactly the `style={{width:'100%',height:'auto'}}`
 * upstream sets on its `<Image>`, so the rendered geometry is the same — what is lost is the
 * reserved aspect box, and with it the CLS protection intrinsic dimensions would have bought.
 * Fixing that properly needs a width/height pair on the content type, which is a model change
 * and therefore out of this file's scope. Recorded rather than papered over.
 *
 * Two smaller departures:
 *
 *   - upstream falls back to `Caption ? <>{Caption}</> : null` when the image is missing.
 *     RENDERER-SPEC asks for `null` on missing required content, and a bare caption line
 *     floating in a full-span column with no image above it reads as stray copy, not as a
 *     caption. `ImageUrl` is the required content, so a missing one returns null.
 *   - upstream renders `{Caption}` as an unwrapped text node. Here it is a real
 *     `<figure>` / `<figcaption>` pair with the opticom caption treatment, which is what makes
 *     the caption look like optimizely.com's rather than like an orphaned sentence.
 *
 * `display-settings.ts` declares this template with an EMPTY settings array (copied from
 * upstream's), so there is nothing to read out of `displaySettings`.
 */
import { EditableField } from '@/lib/optimizely/features/draft'
import type { ImageDisplayElementProps } from './types'

/**
 * `isFirst` is threaded to every renderer by `content-area/mapper` and by
 * `visual-builder.tsx`, but `types.ts` is a Phase 0 file owned by the model, not the
 * renderer, and this task may not edit it. Declared here instead of widened there.
 */
interface Props extends ImageDisplayElementProps {
  isFirst?: boolean
}

export default function ImageDisplayElement({
  ImageUrl,
  AltText,
  Caption,
  isFirst,
}: Props) {
  if (!ImageUrl) return null

  const caption = Caption?.trim()

  return (
    <figure className="w-full">
      <img
        src={ImageUrl}
        alt={AltText ?? ''}
        loading={isFirst ? 'eager' : 'lazy'}
        decoding="async"
        className="block h-auto w-full"
      />
      {caption ? (
        <EditableField
          as="figcaption"
          field="Caption"
          className="font-body text-body-xs mt-3 text-(--color-tertiary-7)"
        >
          {caption}
        </EditableField>
      ) : null}
    </figure>
  )
}
