import { ComponentType } from 'react'
import blocksMapperFactory from '@/lib/utils/block-factory'
import { kebabToPascalCase } from './utils'

interface BlockProps {
  [key: string]: unknown
}

type BlockComponent = ComponentType<BlockProps>
type BlocksMap = Record<string, BlockComponent>

function createBlocksMap(): BlocksMap {
  const blocks: BlocksMap = {}

  const blockModules = import.meta.glob<{ default?: BlockComponent }>(
    '../../../../components/block/*/index.tsx',
    { eager: true }
  )

  Object.keys(blockModules).forEach((modulePath: string) => {
    const folderName = modulePath
      .replace(/^.*\/components\/block\//, '')
      .replace(/\/index\.tsx$/, '')

    const componentName = kebabToPascalCase(folderName)

    const mod = blockModules[modulePath]
    if (mod.default) {
      blocks[componentName] = mod.default
    }
  })

  return blocks
}

export const blocks = createBlocksMap()

export default blocksMapperFactory(blocks)
