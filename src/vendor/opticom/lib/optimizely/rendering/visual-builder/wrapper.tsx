import Component from '../content-area/component'
import type {
  VisualBuilderNode,
  SafeVisualBuilderExperience,
} from '@/lib/optimizely/types/experience'
import { EditableBlock } from '@/lib/optimizely/features/draft'
import { draftClass } from '@/lib/utils/draft-helpers'
import { cn } from '@/lib/utils'

export default function VisualBuilderExperienceWrapper({
  experience,
  locale,
  preview = false,
}: {
  experience?: SafeVisualBuilderExperience
  locale?: string
  preview?: boolean
}) {
  if (!experience?.composition?.nodes) {
    return null
  }

  const { nodes } = experience.composition

  return (
    <div
      className={cn(
        'relative w-full flex-1',
        draftClass(preview, 'vb:outline')
      )}
    >
      <div
        className={cn(
          'relative w-full flex-1',
          draftClass(preview, 'vb:outline')
        )}
      >
        {nodes.map((node: VisualBuilderNode) => {
          if (node.nodeType === 'section') {
            if (node.section) {
              return (
                <EditableBlock
                  key={node.key}
                  blockId={node.key}
                  className="relative w-full"
                  visualBuilderClass="vb:section"
                >
                  <div className={draftClass(preview, 'vb:grid')}>
                    <Component
                      typeName={node.section.__typename}
                      props={{
                        ...node.section,
                        displaySettings: node.displaySettings,
                        rows: node.rows,
                        steps: node.steps,
                        locale,
                        preview: preview,
                      }}
                    />
                  </div>
                </EditableBlock>
              )
            }
          }

          if (node.nodeType === 'component' && node.component) {
            return (
              <EditableBlock
                key={node.key}
                blockId={node.key}
                className="relative w-full"
              >
                <Component
                  typeName={node.component.__typename}
                  props={{
                    ...node.component,
                    displaySettings: node.displaySettings,
                    locale,
                    preview: preview,
                  }}
                />
              </EditableBlock>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
