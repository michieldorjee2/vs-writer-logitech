import * as React from 'react'
import * as PortalPrimitive from '@radix-ui/react-portal'

const Portal = React.forwardRef<
  React.ComponentRef<typeof PortalPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof PortalPrimitive.Root>
>(({ ...props }, ref) => <PortalPrimitive.Root {...props} ref={ref} />)
Portal.displayName = PortalPrimitive.Root.displayName

export { Portal }
