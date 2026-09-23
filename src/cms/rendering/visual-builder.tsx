/**
 * The Visual Builder render chain: an experience's composition, drawn.
 *
 *   experience -> section -> row -> column -> element
 *
 * This is the port of upstream's `lib/optimizely/rendering/visual-builder/wrapper.tsx`,
 * with one structural change, described below, and defaults threaded in at every level.
 *
 * THE WRITE SHAPE AND THE READ SHAPE ARE DIFFERENT, and this file is written against the
 * READ one. The CMA takes `node.component.contentType` + `node.nodes[]`; Graph returns a
 * union — `CompositionComponentNode` carries `component`, `CompositionStructureNode` carries
 * `nodes`, aliased per level as `rows` / `columns` / `elements` by the query. So a section's
 * children arrive as `node.rows`, and the component on a structure node arrives as
 * `node.section`, not `node.component`. See `BlankExperience.graphql` upstream.
 *
 * WHY WE WALK ROWS OURSELVES INSTEAD OF HANDING `rows` TO THE SECTION. Upstream's
 * `BlankSection` takes a `rows` prop and maps it internally, and inside that loop it calls
 * upstream's OWN `ContentAreaMapper`, which dispatches through upstream's OWN component
 * registry — the one that globs `src/vendor/opticom/components/`. Our 27 renderers are not
 * there and never will be, so every element inside every section would silently render as
 * `null`.
 *
 * `BlankSection` already has the seam we need: `const content = hasRows ? rows.map(…) :
 * children`. Passing `children` and no `rows` keeps all of its section chrome — the six
 * background colours, the padding ladder, rounded corners, the container behaviour — and
 * replaces only the part that has to know about our catalogue. Nothing under `src/vendor/`
 * is patched for it.
 *
 * `children` is passed as `undefined` for an empty section rather than as an empty fragment,
 * so `BlankSection`'s own "no rows and no children" early return still fires and an empty
 * band does not paint a background.
 */
import Column from '@/components/layout/column'
import Row from '@/components/layout/row'
import { EditableBlock } from '@/lib/optimizely/features/draft'
import type {
  Column as ColumnNode,
  ExperienceElement,
  Row as RowNode,
  SafeVisualBuilderExperience,
  VisualBuilderNode,
} from '@/lib/optimizely/types/experience'
import { cn } from '@/lib/utils'
import { draftClass } from '@/lib/utils/draft-helpers'
import Component from './component-factory'
import { withContentTypeDefaults, withNodeTypeDefaults } from './display-defaults'
import { bandOf } from './band'

export interface VisualBuilderExperienceProps {
  experience?: SafeVisualBuilderExperience | null
  locale?: string
  /** Draft/edit mode. Threaded to every node so `vb:` outline classes appear in preview. */
  preview?: boolean
}

interface LevelProps {
  locale?: string
  preview?: boolean
}

/** One element inside a column. The leaf of the tree, and the only level we own outright. */
function Element({
  element,
  index,
  locale,
  preview,
}: LevelProps & { element: ExperienceElement; index: number }) {
  const typeName = element.component?.__typename
  if (!typeName) return null

  return (
    <EditableBlock blockId={element.key}>
      <Component
        typeName={typeName}
        props={{
          ...element.component,
          displaySettings: withContentTypeDefaults(typeName, element.displaySettings),
          isFirst: index === 0,
          locale,
          preview,
        }}
      />
    </EditableBlock>
  )
}

function Columns({ columns, locale, preview }: LevelProps & { columns?: ColumnNode[] }) {
  if (!columns?.length) return null

  return (
    <>
      {columns.map((column) => (
        <Column
          key={column.key}
          displaySettings={withNodeTypeDefaults('column', column.displaySettings)}
          preview={preview}
        >
          {column.elements?.map((element, index) => (
            <Element
              key={element.key}
              element={element}
              index={index}
              locale={locale}
              preview={preview}
            />
          )) ?? null}
        </Column>
      ))}
    </>
  )
}

function Rows({ rows, locale, preview }: LevelProps & { rows?: RowNode[] }) {
  if (!rows?.length) return null

  return (
    <>
      {rows.map((row) => (
        <Row
          key={row.key}
          displaySettings={withNodeTypeDefaults('row', row.displaySettings)}
          preview={preview}
        >
          <Columns columns={row.columns} locale={locale} preview={preview} />
        </Row>
      ))}
    </>
  )
}

function SectionNode({ node, locale, preview }: LevelProps & { node: VisualBuilderNode }) {
  const typeName = node.section?.__typename
  if (!typeName) return null

  const hasRows = Boolean(node.rows?.length)
  const sectionSettings = withContentTypeDefaults(typeName, node.displaySettings)

  return (
    <EditableBlock
      blockId={node.key}
      className="relative w-full"
      visualBuilderClass="vb:section"
    >
      {/* `data-band` tells every element inside whether it sits on a dark or a light band.
          Elements render independently and cannot see their section, and BlankSection only
          sets a foreground for `dark_forest` — so without this an element built for a light
          card paints dark ink on the dark band (measured at 1.00:1 on the closing CTA).
          Elements adapt with a `[[data-band=dark]_&]:` variant instead of guessing. */}
      <div className={draftClass(preview, 'vb:grid')} data-band={bandOf(sectionSettings)}>
        <Component
          typeName={typeName}
          props={{
            ...node.section,
            displaySettings: sectionSettings,
            locale,
            preview,
            // See the header: children, never `rows`. An empty section passes undefined so
            // BlankSection's own early return still fires.
            children: hasRows ? (
              <Rows rows={node.rows} locale={locale} preview={preview} />
            ) : undefined,
          }}
        />
      </div>
    </EditableBlock>
  )
}

/** A component placed directly on the experience, outside any section. Upstream allows it. */
function TopLevelComponent({ node, locale, preview }: LevelProps & { node: VisualBuilderNode }) {
  const typeName = node.component?.__typename
  if (!typeName) return null

  return (
    <EditableBlock blockId={node.key} className="relative w-full">
      <Component
        typeName={typeName}
        props={{
          ...node.component,
          displaySettings: withContentTypeDefaults(typeName, node.displaySettings),
          locale,
          preview,
        }}
      />
    </EditableBlock>
  )
}

export default function VisualBuilderExperience({
  experience,
  locale,
  preview = false,
}: VisualBuilderExperienceProps) {
  const nodes = experience?.composition?.nodes
  if (!nodes?.length) return null

  return (
    <div className={cn('relative w-full flex-1', draftClass(preview, 'vb:outline'))}>
      {nodes.map((node) => {
        if (node.nodeType === 'section' && node.section) {
          return <SectionNode key={node.key} node={node} locale={locale} preview={preview} />
        }
        if (node.nodeType === 'component' && node.component) {
          return (
            <TopLevelComponent key={node.key} node={node} locale={locale} preview={preview} />
          )
        }
        return null
      })}
    </div>
  )
}
