import { createElement, ComponentType } from 'react'

type AsyncFunctionComponent<P = Record<string, unknown>> = (
  props: P
) => Promise<React.ReactNode>

type ComponentMap = Record<
  string,
  ComponentType<Record<string, unknown>> | AsyncFunctionComponent
>

export default function blocksMapperFactory<TMap extends ComponentMap>(
  contentTypeMap: TMap
) {
  function factory<TypeName extends keyof TMap>({
    typeName,
    props,
  }: {
    typeName: TypeName
    props: React.ComponentProps<TMap[TypeName]>
  }) {
    const Component = contentTypeMap[typeName]

    if (!Component) {
      return null
    }

    return createElement(Component, props)
  }

  return factory
}
