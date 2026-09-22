# AbmStakeholderElement — divergence from upstream

Upstream optimizely.com models a person as `ContactBlock`, which is shaped for an Optimizely
employee: it carries `CurrentOptimizelyEmployee`, `RouteSegment`, `OpticonProfileImage` and a
`CompanyContentLink` content reference, and it holds exactly one person per block, addressed
by `FirstName`/`LastName`/`JobTitle`/`Bio`. A stakeholder on an account page is the opposite
side of the table — a named person at the customer, carrying an engagement read and a CRM id
that have no upstream equivalent — so reusing `ContactBlock` would mean shipping an
employee-only flag on a customer record and, worse, a content reference that is rejected
outright on an `elementEnabled` type. We therefore declare our own element with a single flat
`Name`, upstream's `JobTitle` collapsed to `Role`, the avatar reduced to `Initials` plus
`AvatarColor` instead of an image reference, and the engagement fields (`EngagementTier`,
`EngagementNote`) plus the two linkage scalars (`PersonSlug`, `CrmContactId`) added. The one
piece of upstream we do keep is the display template: `colorScheme` is copied verbatim from
`card-author-block` so both person cards offer an editor the same choice. `PersonSlug` is what
replaces upstream's content reference — it resolves client-side to that person's own
`PersonExperience` page rather than being stored as a link the CMS would refuse.
