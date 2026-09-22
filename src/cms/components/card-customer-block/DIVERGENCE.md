# CardCustomerBlock — divergence from optimizely.com

Upstream's `ResourceUrl` is a link property: Graph returns
`{ url: { default, base, graph, hierarchical, internal, type }, text, title, target }`, which is
why `index.tsx` reads `ResourceUrl?.url?.default` and the Storybook stories build the card href
through a `mockResourceUrl()` helper. A link is a content reference, and a content reference is a
400 on a content type declaring `elementEnabled` (`The property 'ResourceUrl' is not allowed when
content type has ElementEnabled.`), so we keep the upstream property name and flatten the value:
`ResourceUrl` is a `url` here and holds the href directly. The only consequence for Phase 1 is
that the vendored renderer resolves `href = ResourceUrl` instead of `ResourceUrl?.url?.default` —
every other property name, and the card's markup, ports unchanged. `ImageUrl` and
`CompanyLogoUrl` are `url` rather than upstream's plain strings, which is a stricter editor
affordance with no effect on the rendered value.
