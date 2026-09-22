import displayTemplates from './display-settings'

export interface ButtonBlockProps {
  ButtonText?: string
  ButtonUrl?: string
  Variant?: 'primary' | 'secondary' | 'ghost'
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type ButtonBlockDisplaySettings = (typeof displayTemplates)[0]['settings']
