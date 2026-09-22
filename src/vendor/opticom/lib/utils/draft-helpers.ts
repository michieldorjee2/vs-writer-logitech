export function draftClass(
  isDraft: boolean | undefined,
  ...classes: (string | undefined | false)[]
): string {
  if (!isDraft) {
    return ''
  }
  return classes.filter(Boolean).join(' ')
}
