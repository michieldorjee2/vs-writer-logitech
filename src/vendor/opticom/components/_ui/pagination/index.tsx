import React from 'react'
import { Button } from '@/components/_ui/button'
import { PaginationProps } from './types'

export default function Pagination({
  pageIndex,
  itemsPerPage,
  totalItems,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const maxButtons = 5

  const getPageNumbers = () => {
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const half = Math.floor(maxButtons / 2)

    let start = Math.max(1, pageIndex - half)
    let end = Math.min(totalPages, pageIndex + half)

    if (start === 1) {
      end = maxButtons
    } else if (end === totalPages) {
      start = totalPages - maxButtons + 1
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  const pages = getPageNumbers()
  const showStartEllipsis = pages[0] > 1
  const showEndEllipsis = pages[pages.length - 1] < totalPages
  const startItems = (pageIndex - 1) * itemsPerPage + 1
  const endItems = Math.min(pageIndex * itemsPerPage, totalItems)
  return (
    <>
      {totalItems > 0 && (
        <div className="flex content-center bg-(--color-tertiary-2) px-3 py-4.5">
          <div className="grow content-center">
            Showing {startItems}-{endItems} of {totalItems}
          </div>
          <div className="content-center">
            {pageIndex !== 1 && (
              <Button
                size="sm"
                variant="neutral"
                onClick={() => onPageChange(pageIndex - 1)}
                className="cursor-pointer"
                key="pagination-button-prev"
              >
                Prev
              </Button>
            )}

            {showStartEllipsis && (
              <>
                <Button
                  variant="neutral"
                  className="cursor-pointer"
                  onClick={() => onPageChange(1)}
                  key="pagination-button-first"
                >
                  1
                </Button>
                <span className="px-1">...</span>
              </>
            )}

            {pages.map((p) => (
              <Button
                key={`pagination-button-${p}`}
                variant="neutral"
                size="sm"
                disabled={p === pageIndex}
                onClick={() => onPageChange(p)}
                className="cursor-pointer"
              >
                {p}
              </Button>
            ))}

            {showEndEllipsis && (
              <>
                <span className="px-1">...</span>
                <Button
                  variant="neutral"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => onPageChange(totalPages)}
                  key="pagination-button-last"
                >
                  {totalPages}
                </Button>
              </>
            )}
            {pageIndex !== totalPages && (
              <Button
                variant="neutral"
                size="sm"
                onClick={() => onPageChange(pageIndex + 1)}
                className="cursor-pointer"
                key="pagination-button-next"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
