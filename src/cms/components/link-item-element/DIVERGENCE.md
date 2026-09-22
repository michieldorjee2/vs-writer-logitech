# LinkItemElement replaces upstream LinkListBlock

Upstream's `LinkListBlock` (optimizely.com, `components/block/link-list-block`) holds one
`Links` property — an array of content references, each resolved in Graph to
`{ url { default … }, text, title, target }` — so a whole list of links is a single block, and
its `displayType` display setting (`vertical` / `horizontal`) is chosen once for that block. An
array of content is a 400 on a type declaring `compositionBehaviors: ['elementEnabled']`
(`The property 'Links' is not allowed when content type has ElementEnabled.`), and the eight
element-legal shapes have no way to express a list of anything but plain strings, so there is no
one-block equivalent to port: we make the link itself the unit and place N `LinkItemElement`
nodes in a column instead of one block holding N links. The consequence an editor sees is that
`displayType` now rides on each node and must be set identically across the nodes of one list;
the consequence we want is that a pruned link is a missing node, visible in the composition
tree, where a suppressed entry inside an array property would have been invisible.
