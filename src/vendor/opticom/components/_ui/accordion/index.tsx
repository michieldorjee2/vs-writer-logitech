import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { motion, AnimatePresence } from 'framer-motion'
import { MaterialIcon } from '@/components/element/icon-element'

import { cn } from '@/lib/utils'

const Accordion = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Root
    ref={ref}
    className={cn('w-full', className)}
    {...props}
  />
))
Accordion.displayName = AccordionPrimitive.Root.displayName

const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('overflow-clip rounded-2xl p-8', className)}
    {...props}
  />
))
AccordionItem.displayName = AccordionPrimitive.Item.displayName

const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'group font-body text-body-base/tight flex flex-1 cursor-pointer items-center justify-between gap-8 text-left font-medium text-(--color-secondary-darkfir)',
        className
      )}
      {...props}
    >
      {children}
      <span className="inline-flex shrink-0 transition-transform duration-300 group-data-[state=open]:rotate-180">
        <MaterialIcon name="keyboard_arrow_down" size="24" />
      </span>
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

function useAccordionOpen(ref: React.RefObject<HTMLDivElement | null>) {
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    setIsOpen(el.getAttribute('data-state') === 'open')

    const observer = new MutationObserver(() => {
      setIsOpen(el.getAttribute('data-state') === 'open')
    })
    observer.observe(el, { attributes: true, attributeFilter: ['data-state'] })
    return () => observer.disconnect()
  }, [ref])

  return isOpen
}

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const isOpen = useAccordionOpen(contentRef)

  return (
    <AccordionPrimitive.Content
      ref={(node) => {
        ;(contentRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      forceMount
      {...props}
    >
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                height: {
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                  mass: 0.8,
                },
                opacity: { duration: 0.2, delay: 0.05 },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: {
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                  mass: 0.8,
                },
                opacity: { duration: 0.15 },
              },
            }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'font-body text-body-base/tight pt-6 text-(--color-secondary-darkfir)',
                className
              )}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AccordionPrimitive.Content>
  )
})
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
