# TextContentElement — divergence from upstream

The property name `MainBody` is upstream's and is kept deliberately, but its type is not:
optimizely.com declares `MainBody` as `richText` and selects `MainBody { html json }`, so its
renderer hands `MainBody?.html` to `EditableHtml` and lets the CMS rich-text editor own the
markup. `format: 'richText'` cannot be written through the CMS API at all, so here `MainBody`
is a bare long `string` with no `format` key, carrying plain text with blank lines between
paragraphs. That is also the safer shape for this migration, since the copy filling these
elements is agent-generated and a richText property validates its payload as HTML — a single
stray `<` would fail the whole write. The Phase 1 vendored renderer therefore has to split the
string into paragraphs itself instead of injecting HTML, and inline emphasis and links that a
rich-text field could express are not available on this element.
