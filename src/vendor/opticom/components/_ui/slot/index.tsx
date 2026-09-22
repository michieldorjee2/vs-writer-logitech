import * as React from 'react'
import { Slot as SlotPrimitive } from '@radix-ui/react-slot'

interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode
}

const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...props }, ref) => (
    <SlotPrimitive ref={ref} {...props}>
      {children}
    </SlotPrimitive>
  )
)
Slot.displayName = 'Slot'

export { Slot }
