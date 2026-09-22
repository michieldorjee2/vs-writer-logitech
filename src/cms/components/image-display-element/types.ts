import displayTemplates from './display-settings'

export interface ImageDisplayElementProps {
  /** Absolute image URL. Replaces upstream's `ImageReference`. */
  ImageUrl?: string
  AltText?: string
  Caption?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type ImageDisplayElementDisplaySettings = (typeof displayTemplates)[0]['settings']
