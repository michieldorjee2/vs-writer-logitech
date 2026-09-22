# ButtonBlock diverges from upstream

Upstream's `ButtonBlock` (optimizely.com, `components/block/button-block`) holds a single
`Link` property — a content reference resolved in Graph to `{ url { default … }, text, title,
target }` — and the React component reads `Link.text` and `Link.url.default`, returning `null`
when the destination is missing. A content reference is a 400 on a type declaring
`compositionBehaviors: ['elementEnabled']` (`The property 'Link' is not allowed when content
type has ElementEnabled.`), so we flatten it to two scalars, `ButtonText` (shortString, 40) and
`ButtonUrl` (url, the only required property, mirroring upstream's refusal to render without a
destination); we drop `title` and `target`, which no Limitless page sets, and we add a
`Variant` selectOne (`primary` / `secondary` / `ghost`) because an agent composing a page writes
content properties and has no display settings to write into — the upstream `buttonVariant`
display setting is kept verbatim alongside it and stays the renderer's source of truth, so
Phase 1's vendored React needs no change and `Variant` is only the authoring-time default it
falls back to.
