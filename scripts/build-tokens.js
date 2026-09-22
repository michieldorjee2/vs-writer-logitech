/** This file converts the Figma exported tokens to CSS for tailwind to consume */

import StyleDictionary from 'style-dictionary'
import { register } from '@tokens-studio/sd-transforms'
import { readdirSync, existsSync, rmSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/*
 * Vendored from optimizely.com's "opticom" app. The only change from upstream is
 * this block: upstream resolves every token path against process.cwd(), which is
 * fine for a script that is only ever run as an npm script from the repo root.
 * Here it is also run from scripts/ and from a capture harness, so paths are
 * resolved against the repo root instead.
 */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoPath = (...segments) => path.join(REPO, ...segments)

register(StyleDictionary)

StyleDictionary.registerTransform({
  name: 'name/cti/kebab-full',
  type: 'name',
  transform: (token) => {
    return token.path
      .join('-')
      .replace(/_/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase()
  },
})

StyleDictionary.registerTransform({
  name: 'color/hsl-tailwind-v4',
  type: 'value',
  filter: (token) => token.type === 'color',
  transform: (token) => {
    const hex = token.value
    const result =
      /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex)
    if (!result) return hex

    const r = parseInt(result[1], 16) / 255
    const g = parseInt(result[2], 16) / 255
    const b = parseInt(result[3], 16) / 255
    const a = result[4] ? parseInt(result[4], 16) / 255 : 1

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6
          break
        case g:
          h = ((b - r) / d + 2) / 6
          break
        case b:
          h = ((r - g) / d + 4) / 6
          break
      }
    }

    h = Math.round(h * 360)
    s = Math.round(s * 100)
    const lRounded = Math.round(l * 100)

    return a < 1
      ? `hsl(${h} ${s}% ${lRounded}% / ${a})`
      : `hsl(${h} ${s}% ${lRounded}%)`
  },
})

StyleDictionary.registerTransform({
  name: 'size/px-unit',
  type: 'value',
  filter: (token) => {
    if (token.type === 'color') return false
    if (token.path.includes('opacity')) return false
    if (token.path.includes('weight')) return false
    if (token.path.includes('family')) return false
    return typeof token.value === 'number'
  },
  transform: (token) => {
    const val = parseFloat(token.value)
    if (isNaN(val)) return token.value
    if (val === 0) return '0'
    if (val === 999) return '9999px'
    return `${val}px`
  },
})

StyleDictionary.registerTransform({
  name: 'opacity/percentage',
  type: 'value',
  filter: (token) => token.path.includes('opacity'),
  transform: (token) => {
    const val = parseFloat(token.value)
    if (isNaN(val)) return token.value
    // Tailwind v4 uses color-mix() which requires percentage values
    // Source values are 0-100, output as percentages
    if (val === 0) return '0%'
    return `${Math.round(val)}%`
  },
})

const METADATA_KEYS = new Set([
  'value',
  'type',
  '$extensions',
  'description',
  '$description',
  '$type',
])

StyleDictionary.registerPreprocessor({
  name: 'resolve-composite-tokens',
  preprocessor: (dictionary) => {
    function processLevel(parent) {
      if (!parent || typeof parent !== 'object') return

      let changed = true
      while (changed) {
        changed = false
        for (const key of Object.keys(parent)) {
          if (METADATA_KEYS.has(key)) continue
          const node = parent[key]
          if (!node || typeof node !== 'object' || !('value' in node)) continue

          const childTokenKeys = Object.keys(node).filter((k) => {
            if (METADATA_KEYS.has(k)) return false
            return node[k] && typeof node[k] === 'object' && 'value' in node[k]
          })

          if (childTokenKeys.length > 0) {
            for (const ck of childTokenKeys) {
              parent[`${key}-${ck}`] = node[ck]
              delete node[ck]
            }
            changed = true
            break
          }
        }
      }

      for (const key of Object.keys(parent)) {
        if (METADATA_KEYS.has(key)) continue
        if (parent[key] && typeof parent[key] === 'object') {
          processLevel(parent[key])
        }
      }
    }

    processLevel(dictionary)
    return dictionary
  },
})

StyleDictionary.registerFormat({
  name: 'css/tailwind-v4-theme',
  format: ({ dictionary }) => {
    let output =
      '/**\n * Do not edit directly, this file was auto-generated.\n */\n\n'
    output += '@theme {\n'

    dictionary.allTokens.forEach((token) => {
      output += `  --${token.name}: ${token.value};\n`
    })

    output += '}\n'
    return output
  },
})

StyleDictionary.registerFormat({
  name: 'css/tailwind-v4-theme-scoped',
  format: ({ dictionary, options }) => {
    const className = options.selector || '.theme'
    let output =
      '/**\n * Do not edit directly, this file was auto-generated.\n */\n\n'
    output += `${className} {\n`

    dictionary.allTokens.forEach((token) => {
      output += `  --${token.name}: ${token.value};\n`
    })

    output += '}\n'
    return output
  },
})

function loadScopedThemes() {
  const themesFile = repoPath('tokens/themes.json')
  if (!existsSync(themesFile)) {
    return []
  }
  try {
    const content = readFileSync(themesFile, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.warn('Failed to parse themes.json:', error.message)
    return []
  }
}

function discoverThemes() {
  const themesDir = repoPath('tokens/TailwindCSS')
  const files = readdirSync(themesDir).filter((f) => f.endsWith('.json'))
  return files.map((f) => f.replace('.json', ''))
}

function buildTheme(themeName, scopedThemes) {
  const isScopedTheme = scopedThemes.includes(themeName)
  const themeSlug = themeName.toLowerCase()

  const sources = []
  const tailwindPath = repoPath('tokens/TailwindCSS', `${themeName}.json`)
  const semanticPath = repoPath('tokens/Semantic', `${themeName}.json`)
  const overridePath = repoPath('tokens/overrides', `${themeName}.json`)

  if (existsSync(tailwindPath)) {
    sources.push(tailwindPath)
  }

  if (existsSync(semanticPath)) {
    sources.push(semanticPath)
  }

  if (existsSync(overridePath)) {
    sources.push(overridePath)
    console.log(`  Applying overrides: ${overridePath}`)
  }

  if (sources.length === 0) {
    console.warn(`No token files found for theme: ${themeName}`)
    return
  }

  const sd = new StyleDictionary({
    source: sources,
    preprocessors: ['resolve-composite-tokens', 'tokens-studio'],
    platforms: {
      css: {
        transforms: [
          'name/cti/kebab-full',
          'ts/resolveMath',
          'ts/size/px',
          'ts/size/lineheight',
          'ts/typography/fontWeight',
          'color/hsl-tailwind-v4',
          'size/px-unit',
          'opacity/percentage',
        ],
        buildPath: repoPath('tokens/compiled') + path.sep,
        files: [
          {
            destination: `${themeSlug}.css`,
            format: isScopedTheme
              ? 'css/tailwind-v4-theme-scoped'
              : 'css/tailwind-v4-theme',
            options: {
              selector: `.theme--${themeSlug}`,
            },
          },
        ],
      },
    },
  })

  return sd.buildAllPlatforms()
}

const scopedThemes = loadScopedThemes()
const themes = discoverThemes()

console.log(`Found ${themes.length} theme(s): ${themes.join(', ')}`)
if (scopedThemes.length > 0) {
  console.log(`Scoped themes (from themes.json): ${scopedThemes.join(', ')}`)
}

if (existsSync(repoPath('tokens/compiled'))) {
  rmSync(repoPath('tokens/compiled'), { recursive: true, force: true })
  console.log('Cleaned tokens/compiled directory')
}

for (const theme of themes) {
  const isScopedTheme = scopedThemes.includes(theme)
  const format = isScopedTheme ? 'scoped (.theme--)' : '@theme'
  console.log(`\nBuilding theme: ${theme} [${format}]`)
  await buildTheme(theme, scopedThemes)
  const themeSlug = theme.toLowerCase()
  console.log(`✓ Generated: tokens/compiled/${themeSlug}.css`)
}

console.log('\nTokens compiled successfully!')
