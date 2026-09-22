import * as React from 'react'
import * as DirectionPrimitive from '@radix-ui/react-direction'

const DirectionProvider: React.FC<
  React.ComponentPropsWithoutRef<typeof DirectionPrimitive.Provider>
> = ({ ...props }) => <DirectionPrimitive.Provider {...props} />
DirectionProvider.displayName = DirectionPrimitive.Provider.displayName

export { DirectionProvider }
