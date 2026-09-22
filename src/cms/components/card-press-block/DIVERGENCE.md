# CardPressBlock — divergence from optimizely.com

Two values change shape while every property name stays upstream's. First, `ResourceUrl`: upstream
stores a link, so Graph returns `{ url: { default, … }, text, title, target }` and `index.tsx` reads
`ResourceUrl?.url?.default`; a link is a content reference and a content reference is a 400 on an
`elementEnabled` type, so here `ResourceUrl` is a `url` holding the href directly and the vendored
renderer resolves `href = ResourceUrl`. Second, `PublishDate`: upstream's value is a pre-formatted
display string — its own stories pass `'19th Jan 2026'` and `'28th February 2026'`, and the
component prints it verbatim — whereas we declare a `dateTime`, so the press wall can sort and
localize dates instead of trusting whatever an author typed. The cost is that Phase 1 must format
the instant at render time rather than printing it raw. Note the deliberate asymmetry with
`AbmNewsItemElement.NewsDate`, which stays a `shortString` because its source values ("Mar 2026")
are month-precision display strings that a `dateTime` cannot represent without inventing a day.
