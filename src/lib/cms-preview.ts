/**
 * The page is the CMS's preview of a draft (src/components/CmsPreview.tsx, `/preview`), not a
 * visitor's visit: nothing is tracked and nothing is sent. An editor who clicks "Talk to your
 * team" or tries the sign-up form to see what happens must not message a rep or sign anyone up.
 */
export function inCmsPreview(location: { pathname: string } | null = typeof window === 'undefined' ? null : window.location): boolean {
  return !!location && location.pathname.replace(/\/+$/, '') === '/preview';
}
