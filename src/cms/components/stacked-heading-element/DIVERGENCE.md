# StackedHeadingElement — divergence from upstream

Upstream optimizely.com declares `Text` as a `richText` property and its GraphQL fragment
selects `Text { html }`, so the renderer receives an HTML string and strips the tags itself
(`parseRichTextHtml`), also reading `text-align` out of that markup to decide alignment. Here
`Text` is a bare long `string` with no `format` key, because `format: 'richText'` cannot be
created through the CMS API on any surface or composition behaviour — and because our copy is
agent-generated prose that a richText property would reject outright the first time it
contained a bare `<`. The consequences for the Phase 1 vendored renderer are that `Text` must
be read as a plain string rather than `Text.html`, and that alignment can no longer be
inferred from markup and has to come from the display template or the column instead. The
`##phrase##` extrusion markers and the newline-per-line convention survive unchanged, as does
`HeadingLevel` — narrowed to h1–h4 by the `selectOne` enum, where upstream's TypeScript type
also allowed h5, h6 and span.
