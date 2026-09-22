# AbmNewsItemElement — divergence

There is no optimizely.com component to port; the divergence is from the obvious modelling of a
date, and from the sibling `CardPressBlock.PublishDate` in this same group, which is a `dateTime`.
`NewsDate` is a `shortString`. The source values in `newsItems` are display strings at whatever
precision the source published — "Mar 2026" is typical — so coercing them to an instant would
force us to invent a day and a time we do not have, and the rail would then render a false
precision back to the reader. Storing the string keeps the account page showing exactly what the
source said; the cost is that a news rail cannot be sorted or localized by the CMS, which is
acceptable because the rail is authored in the order it should read.
