# AbmFrictionPointElement diverges from upstream's `CalloutBlock`

optimizely.com renders this kind of card with `CalloutBlock`, which holds a `CalloutType`
select and a single `CalloutText` rich-text property: the heading is folded into the markup of
that one field, so a title is only ever a `<strong>` at the start of a blob of HTML. We split
it into two typed properties instead, `Title` (shortString) and `Description` (a bare long
string), keeping the same names the live `ABMPainPoint` component already uses on
`CompetitorComparisonPage.painPoints`. Two reasons. Graph and Visual Builder's Edit mode can
then address `Title` and `Description` separately — an editor edits a heading as a heading, and
a query can select one without parsing HTML out of the other — and a rich-text property is not
creatable through the API in any case (`format: 'richText'` is rejected on every surface), nor
would it survive our copy: agent-generated prose containing a bare `<` fails a richText write
outright. The variant choice that `CalloutType` carried as content moves to the display
template as `colorScheme`.
