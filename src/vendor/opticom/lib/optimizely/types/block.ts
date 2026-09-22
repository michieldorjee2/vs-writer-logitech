export interface BlockBase {
  isFirst: boolean
  preview: boolean
  displaySettings?: {
    value: string
    key: string
  }[]
}
