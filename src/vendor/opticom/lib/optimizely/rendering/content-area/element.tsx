import { ComponentType, Suspense, lazy } from 'react'
import blocksMapperFactory from '@/lib/utils/block-factory'
import { kebabToPascalCase } from './utils'

interface ElementProps {
  [key: string]: unknown
}

type AsyncFunctionComponent<P = ElementProps> = (
  props: P
) => Promise<React.ReactNode>

type ElementComponent = ComponentType<ElementProps> | AsyncFunctionComponent
type ElementsMap = Record<string, ElementComponent>

function createElementsMap(): ElementsMap {
  const elements: ElementsMap = {}

  const elementModules = import.meta.glob(
    '../../../../components/element/*/index.tsx'
  )

  Object.keys(elementModules).forEach((modulePath: string) => {
    const folderName = modulePath
      .replace(/^.*\/components\/element\//, '')
      .replace(/\/index\.tsx$/, '')

    const componentName = kebabToPascalCase(folderName)

    const Loaded = lazy(
      elementModules[modulePath] as () => Promise<{
        default: ComponentType<ElementProps>
      }>
    )

    function LazyElement(props: ElementProps) {
      return (
        <Suspense fallback={null}>
          <Loaded {...props} />
        </Suspense>
      )
    }
    LazyElement.displayName = `Lazy(${componentName})`

    elements[componentName] = LazyElement
  })

  return elements
}

export const elements = createElementsMap()

export default blocksMapperFactory(elements)
