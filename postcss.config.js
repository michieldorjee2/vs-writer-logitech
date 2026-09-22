/*
 * Tailwind v4 is no longer a PostCSS plugin itself — `@tailwindcss/postcss` is
 * the adapter, and listing bare `tailwindcss` here fails with "It looks like
 * you're trying to use tailwindcss directly as a PostCSS plugin."
 *
 * autoprefixer is dropped on purpose: v4 runs Lightning CSS internally and
 * prefixes what still needs prefixing for its own browser targets. Keeping
 * autoprefixer on top is the setup v4's own docs tell you to remove, and it
 * re-prefixes already-prefixed output. The 21 hand-written stylesheets ship
 * their own `-webkit-` prefixes inline (mask-image, background-clip,
 * text-size-adjust), so nothing in them depended on it.
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
