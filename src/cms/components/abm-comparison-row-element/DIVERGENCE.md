# AbmComparisonRowElement diverges from the live `ComparisonRow` type

Showcase already carries a `ComparisonRow` `_component` with `Category` (shortString, max 50,
required), `OurValue` and `CompetitorValue` (selectOne Yes / No / Limited) plus the booleans
`OurHighlight` and `CompetitorHighlight`, and it is used as a list-item component inside the
`comparisonTableRows` array on `CompetitorComparisonPage`. This element keeps that type's
property names, its 50-character `Category` cap and its exact Yes / No / Limited enum so a
migrated row reads as the same row, but it diverges in three ways: it declares
`compositionBehaviors: ['elementEnabled']` so one row is an addressable node in a Visual
Builder column rather than an invisible entry in an array property; it adds `OurDetail` and
`CompetitorDetail` as 120-character strings, which is the qualifying line the array shape had
nowhere to put; and it drops `OurHighlight` / `CompetitorHighlight`, because a highlight is a
presentation choice and now lives in the display template as `emphasis`, where an editor can
change it without a content write. The live `ComparisonRow` type is left untouched — a property
change on an existing type takes about 40 minutes to reach Graph and one such drift already
404'd 2,676 published pages.
