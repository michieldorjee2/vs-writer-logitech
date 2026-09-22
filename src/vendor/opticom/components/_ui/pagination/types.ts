export interface PaginationProps {
  pageIndex: number
  itemsPerPage: number
  totalItems: number
  onPageChange: (page: number) => void
}
