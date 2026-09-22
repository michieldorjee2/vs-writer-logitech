import {
  createContext,
  useContext,
  type ReactNode,
  type ComponentType,
} from 'react'

interface DraftModeContextValue {
  isEditMode: boolean
  version?: string
  currentRoute?: string
}

const DraftModeContext = createContext<DraftModeContextValue>({
  isEditMode: false,
})

interface DraftModeProviderProps {
  children: ReactNode
  isEditMode?: boolean
  version?: string
  currentRoute?: string
}

export function DraftModeProvider({
  children,
  isEditMode = false,
  version,
  currentRoute,
}: DraftModeProviderProps) {
  return (
    <DraftModeContext.Provider value={{ isEditMode, version, currentRoute }}>
      {children}
    </DraftModeContext.Provider>
  )
}

export function useEditMode(): DraftModeContextValue {
  return useContext(DraftModeContext)
}

export function useDraftMode(): boolean {
  const { isEditMode } = useContext(DraftModeContext)
  return isEditMode
}

export function withDraftMode<P extends object>(
  WrappedComponent: ComponentType<P & { isEditMode: boolean }>
): ComponentType<P> {
  function WithDraftModeWrapper(props: P) {
    const { isEditMode } = useEditMode()
    return <WrappedComponent {...props} isEditMode={isEditMode} />
  }

  WithDraftModeWrapper.displayName = `WithDraftMode(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`

  return WithDraftModeWrapper
}

export function useEditableProps(
  field: string
): Record<string, string> | undefined {
  const { isEditMode } = useContext(DraftModeContext)
  if (!isEditMode) return undefined
  return { 'data-epi-edit': field }
}

export function useBlockProps(
  blockId: string
): Record<string, string> | undefined {
  const { isEditMode } = useContext(DraftModeContext)
  if (!isEditMode) return undefined
  return { 'data-epi-block-id': blockId }
}
