# CalloutBlock — divergence from optimizely.com

Upstream `CalloutBlock` has two properties, `CalloutType` and a rich-text `CalloutText` that
the GraphQL fragment selects as `CalloutText { html }` and the renderer injects with
`dangerouslySetInnerHTML`. We keep the names but not the shapes. `CalloutText` is a bare long
`string` because `format: 'richText'` cannot be created through the CMS API on any surface,
baseType or composition behaviour, which also suits agent-generated prose: a richText property
validates its payload as HTML and a stray `<` in generated copy would fail the whole write.
Upstream's `getCalloutHtml()` already accepts a plain string as well as a `{ html }` object, so
the vendored renderer needs no change. `CalloutHeading` is added — upstream has none — so that
an offer card can carry its promo heading as a real property instead of folding a heading into
the body markup, which with plain text it could no longer do. `CalloutType`'s enum is
upstream's four rendered variants (`info`, `warning`, `error`, `default`) rather than the
assignment's guessed `[info, warning, success, promo]`, because upstream's renderer maps any
value outside that list to the neutral `default` treatment, so `success` and `promo` would be
stored by the CMS and then silently render as flat neutral.
