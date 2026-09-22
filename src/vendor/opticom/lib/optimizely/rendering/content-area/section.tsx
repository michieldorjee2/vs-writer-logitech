import { ComponentType } from 'react'
import blocksMapperFactory from '@/lib/utils/block-factory'
import { kebabToPascalCase } from './utils'

interface SectionProps {
  [key: string]: unknown
}

type SectionComponent = ComponentType<SectionProps>
type SectionsMap = Record<string, SectionComponent>

function createSectionsMap(): SectionsMap {
  const sections: SectionsMap = {}

  const sectionModules = import.meta.glob<{ default?: SectionComponent }>(
    '../../../../components/section/*/index.tsx',
    { eager: true }
  )

  Object.keys(sectionModules).forEach((modulePath: string) => {
    const folderName = modulePath
      .replace(/^.*\/components\/section\//, '')
      .replace(/\/index\.tsx$/, '')

    const componentName = kebabToPascalCase(folderName)

    const mod = sectionModules[modulePath]
    if (mod.default) {
      sections[componentName] = mod.default
    }
  })

  return sections
}

export const sections = createSectionsMap()

export default blocksMapperFactory(sections)
