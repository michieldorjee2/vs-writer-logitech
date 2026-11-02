import Link from '../../../../_shims/next-link'
import type { NavigationColumnsProps } from './types'

export function NavigationColumns({
  columns,
  promoCard,
}: NavigationColumnsProps) {
  if (!columns || columns.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-8 xl:grid-cols-12">
      {columns.map((column, index) => (
        <div
          key={index}
          className={
            index === 2
              ? 'order-1 col-span-2 xl:col-span-2'
              : 'order-1 xl:col-span-2'
          }
        >
          <h3 className="font-headline text-fir-darkfir text-lg leading-[1.3] font-extrabold tracking-[0.02em] lg:text-3xl">
            {column.title}
          </h3>
          <nav className="mt-8 flex flex-col gap-8">
            {column.links?.map((link, linkIndex) => (
              <Link
                key={linkIndex}
                href={link.href ?? '/'}
                data-text={link.label}
                className="font-body text-fir-darkfir text-base leading-[1.3] font-medium before:invisible before:block before:h-0 before:overflow-hidden before:font-bold before:content-[attr(data-text)] hover:font-bold hover:underline lg:text-lg"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ))}
      {promoCard && (
        <div className="order-0 col-span-2 mb-3 max-w-[500px] md:mb-0 lg:order-last lg:col-span-4 lg:col-start-9 lg:max-w-none">
          {promoCard}
        </div>
      )}
    </div>
  )
}
