interface TaxonomyTagProps {
  label: string
  className?: string
}

export function TaxonomyTag({ label, className }: TaxonomyTagProps) {
  return (
    <span
      className={
        className ??
        'font-overline text-body-xxs rounded-[8px] border border-(--color-secondary-darkfir) px-3 py-2 leading-[1.2] tracking-[0.42px] text-(--color-secondary-darkfir) uppercase'
      }
    >
      {label}
    </span>
  )
}
