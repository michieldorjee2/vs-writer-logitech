import Block from './block'
import Element from './element'
import Section from './section'

interface ComponentProps {
  typeName?: string
  props: Record<string, unknown>
}

function Component({ typeName, props }: ComponentProps) {
  if (!typeName) return null

  // Check component type based on typename
  if (typeName.includes('Element')) {
    return <Element typeName={typeName} props={props} />
  }

  // Try Section first for section-like components
  if (typeName.includes('Section') || typeName.includes('ContainerData')) {
    return <Section typeName={typeName} props={props} />
  }

  // Default to Block
  return <Block typeName={typeName} props={props} />
}

export default Component
