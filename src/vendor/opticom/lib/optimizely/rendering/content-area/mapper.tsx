import {
  ExperienceElement,
  VisualBuilderNode,
} from '@/lib/optimizely/types/experience'
import Component from './component'
import { EditableBlock } from '@/lib/optimizely/features/draft'
import { DataPlatformProfile } from '@/lib/products/odp/types'

interface ContentAreaMapperProps {
  blocks?: Array<Record<string, unknown> & { __typename?: string }> | null
  locale?: string
  preview?: boolean
  isVisualBuilder?: boolean
  experienceElements?: ExperienceElement[] | VisualBuilderNode[] | null
  profile?: DataPlatformProfile | null
}

type ComponentElement = Record<string, unknown> & { __typename?: string }

function getElementType(
  element: ExperienceElement | VisualBuilderNode | ComponentElement
): 'experience' | 'visualBuilder' | 'block' | 'unknown' {
  if ('displaySettings' in element) return 'experience'
  if ('component' in element || 'section' in element) return 'visualBuilder'
  if ('__typename' in element) return 'block'
  return 'unknown'
}

function ContentAreaMapper({
  blocks,
  locale,
  preview = false,
  isVisualBuilder = false,
  experienceElements,
  profile,
}: ContentAreaMapperProps) {
  if (isVisualBuilder) {
    const elementsToRender = experienceElements || blocks
    if (!elementsToRender || elementsToRender.length === 0) {
      return null
    }

    return (
      <>
        {elementsToRender.map((element, index) => {
          let displaySettings: ExperienceElement['displaySettings'] | undefined
          let actualComponent: ComponentElement | undefined
          let key: string

          switch (getElementType(element)) {
            case 'experience': {
              const experienceElement = element as ExperienceElement
              displaySettings = experienceElement.displaySettings
              actualComponent = experienceElement.component as ComponentElement
              key = experienceElement.key
              break
            }
            case 'visualBuilder': {
              const visualBuilderNode = element as VisualBuilderNode
              const component = visualBuilderNode.component
              const section =
                'section' in visualBuilderNode
                  ? visualBuilderNode.section
                  : undefined
              actualComponent = (component || section) as ComponentElement
              key = visualBuilderNode.key
              break
            }
            case 'block': {
              actualComponent = element as ComponentElement
              key = `block-${index}`
              break
            }
            default:
              return null
          }

          const typeName = actualComponent?.__typename

          return (
            <EditableBlock
              blockId={key}
              key={`${typeName || 'unknown'}--${index}`}
            >
              <Component
                typeName={typeName}
                props={{
                  ...actualComponent,
                  displaySettings,
                  isFirst: index === 0,
                  locale,
                  preview,
                  profile,
                }}
              />
            </EditableBlock>
          )
        })}
      </>
    )
  }

  if (!blocks || blocks.length === 0) return null

  return (
    <>
      {blocks.map(({ __typename, ...props }, index) => (
        <Component
          key={`${__typename || 'unknown'}--${index}`}
          typeName={__typename}
          props={{
            ...props,
            isFirst: index === 0,
            locale,
            preview,
            profile,
          }}
        />
      ))}
    </>
  )
}

export default ContentAreaMapper
