# ImageDisplayElement — divergence from optimizely.com

Upstream `ImageDisplayBlock` points at an image through `ImageReference`, a content reference
whose GraphQL fragment pulls `url.default` plus the linked item's own width, height and
`AltText`, letting the renderer hand `next/image` real intrinsic dimensions and letting the CMS
or the DAM own the rendition and the focal point. A content reference is rejected outright on
an `elementEnabled` type, so this component takes a plain `ImageUrl` instead and is renamed to
`ImageDisplayElement` so the name does not promise upstream's shape; `AltText` and `Caption`
keep their upstream names and meaning. The cost is real and worth stating plainly: no CMS
renditions, no DAM focal point, no intrinsic width and height, so the Phase 1 renderer must
size the image from CSS rather than from the asset, and alt text has no asset-level value to
fall back to, which is why `AltText` is authored here. What we gain is the reason this shape
was chosen: the element accepts an external screenshot URL directly, with no DAM upload step
between capturing an image and composing a page.
