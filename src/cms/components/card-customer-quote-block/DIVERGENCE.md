# CardCustomerQuoteBlock — divergence from upstream

Upstream optimizely.com authors this block's two URL fields differently from each other:
`ResourceUrl` is a link-shaped property, selected in the Graph fragment as
`ResourceUrl { url { default } }` and read in the renderer as `ResourceUrl?.url?.default`,
while `CompanyLogoUrl` is a plain string, selected bare in the same fragment and passed
straight into `CardBottomBar`'s `companyLogoUrl?: string | null`. We declare both as CMS
`url` properties, because this migration's element model has exactly eight legal property
shapes and a single typed `url` is the right one for an absolute address an editor pastes in;
having one of the two be a free-text string would let an editor save something that is not a
URL at all and would push the validation into the renderer. The consequence lands on Phase 1:
the vendored upstream component reads `CompanyLogoUrl` as a bare string, so whoever wires the
renderer must check what a `url` property actually returns from Graph and unwrap both fields
the same way, rather than assuming upstream's split of one object and one string.
