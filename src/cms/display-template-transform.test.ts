/// <reference types="node" />
/**
 * Round-trip proof for the display template transform.
 *
 *   npx tsx src/cms/display-template-transform.test.ts
 *
 * Self-contained on purpose: this repo has no test runner, and the one claim that has to hold
 * — "the round trip is lossless except for defaultValue" — should be checkable with nothing
 * but tsx.
 */

import assert from 'node:assert/strict'

import {
  extractDefaults,
  extractTemplateDefaults,
  fromCmsDisplayTemplate,
  normalizeRepoDisplayTemplate,
  resolveDefaultTemplateKey,
  stripDefaults,
  toCmsDisplayTemplate,
  toCmsDisplayTemplateBody,
  type RepoDisplayTemplate,
} from './display-template-transform'

let passed = 0
const failures: string[] = []

function test(name: string, fn: () => void): void {
  try {
    fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`)
    console.log(`  FAIL ${name}`)
    console.log(`       ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`)
  }
}

/** Reattach the defaults the CMS cannot store, so the original can be compared field for field. */
function reattachDefaults(
  template: RepoDisplayTemplate,
  defaults: Record<string, string>
): RepoDisplayTemplate {
  return {
    ...template,
    settings: template.settings.map((s) =>
      defaults[s.key] === undefined ? s : { ...s, defaultValue: defaults[s.key] }
    ),
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Copied verbatim from upstream `components/block/stat-block/display-settings.ts` — the shape
 * the nine component agents are told to emit.
 */
const STAT_BLOCK: RepoDisplayTemplate = {
  key: 'StatBlockDisplayTemplate',
  displayName: 'Stat Block Display Template',
  contentType: 'StatBlock',
  isDefault: true,
  settings: [
    {
      key: 'animationMode',
      displayName: 'Animation Mode',
      type: 'select',
      required: false,
      options: [
        { value: 'none', displayName: 'None' },
        { value: 'scroll', displayName: 'Scroll' },
        { value: 'mouse', displayName: 'Mouse' },
      ],
      defaultValue: 'none',
    },
    {
      key: 'extrusionCount',
      displayName: 'Extrusion Layers',
      type: 'select',
      required: false,
      options: [
        { value: 'layers_5', displayName: '5 Layers' },
        { value: 'layers_6', displayName: '6 Layers' },
        { value: 'layers_7', displayName: '7 Layers' },
        { value: 'layers_8', displayName: '8 Layers' },
        { value: 'layers_9', displayName: '9 Layers' },
      ],
      defaultValue: 'layers_5',
    },
    {
      key: 'invertExtrusion',
      displayName: 'Invert Extrusion',
      type: 'select',
      required: false,
      options: [
        { value: 'false', displayName: 'Normal' },
        { value: 'true', displayName: 'Inverted' },
      ],
      defaultValue: 'false',
    },
  ],
}

/** Mixed: a select, a checkbox with no options, a description, an omitted isDefault. */
const MIXED: RepoDisplayTemplate = {
  key: 'CallToActionSettings',
  displayName: 'Button settings',
  description: 'How the button renders',
  contentType: 'CallToAction',
  settings: [
    {
      key: 'colorScheme',
      displayName: 'Color scheme',
      description: 'Palette slot',
      type: 'select',
      required: true,
      options: [
        { value: 'default', displayName: 'Default' },
        { value: 'primary', displayName: 'Primary' },
      ],
      defaultValue: 'default',
    },
    {
      key: 'border',
      displayName: 'Borded',
      type: 'checkbox',
      defaultValue: 'false',
    },
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('display-template-transform')

test('round trip is lossless except for defaultValue', () => {
  for (const fixture of [STAT_BLOCK, MIXED]) {
    const back = fromCmsDisplayTemplate(toCmsDisplayTemplate(fixture))
    const expected = stripDefaults(normalizeRepoDisplayTemplate(fixture))
    assert.deepStrictEqual(back, expected, `fixture ${fixture.key}`)
  }
})

test('defaultValue is the ONLY thing lost — reattaching it restores the original exactly', () => {
  for (const fixture of [STAT_BLOCK, MIXED]) {
    const back = fromCmsDisplayTemplate(toCmsDisplayTemplate(fixture))
    const restored = reattachDefaults(back, extractDefaults(fixture.settings))
    assert.deepStrictEqual(
      restored,
      normalizeRepoDisplayTemplate(fixture),
      `fixture ${fixture.key}`
    )
  }
})

test('a second round trip is a fixed point', () => {
  const once = fromCmsDisplayTemplate(toCmsDisplayTemplate(MIXED))
  const twice = fromCmsDisplayTemplate(toCmsDisplayTemplate(once))
  assert.deepStrictEqual(twice, once)
})

test('settings become a keyed map, type becomes editor, options become a choices map', () => {
  const cms = toCmsDisplayTemplate(MIXED)
  assert.deepStrictEqual(Object.keys(cms.settings), ['colorScheme', 'border'])
  assert.equal(cms.settings.colorScheme.editor, 'select')
  assert.equal(cms.settings.border.editor, 'checkbox')
  assert.deepStrictEqual(cms.settings.colorScheme.choices, {
    default: { displayName: 'Default', sortOrder: 10 },
    primary: { displayName: 'Primary', sortOrder: 20 },
  })
  // A checkbox with no options carries an empty choices map, not an absent one.
  assert.deepStrictEqual(cms.settings.border.choices, {})
})

test('no CMS payload anywhere carries a defaultValue key', () => {
  for (const fixture of [STAT_BLOCK, MIXED]) {
    const body = toCmsDisplayTemplateBody(fixture)
    assert.equal(JSON.stringify(body).includes('defaultValue'), false, fixture.key)
    for (const setting of Object.values(body.settings)) {
      assert.equal('defaultValue' in setting, false, `${fixture.key} setting`)
      for (const choice of Object.values(setting.choices)) {
        assert.deepStrictEqual(Object.keys(choice).sort(), ['displayName', 'sortOrder'])
      }
    }
  }
})

test('sortOrder runs in steps of 10 for settings and for choices', () => {
  const cms = toCmsDisplayTemplate(STAT_BLOCK)
  assert.deepStrictEqual(
    Object.values(cms.settings).map((s) => s.sortOrder),
    [10, 20, 30]
  )
  assert.deepStrictEqual(
    Object.values(cms.settings.extrusionCount.choices).map((c) => c.sortOrder),
    [10, 20, 30, 40, 50]
  )
})

test('CMS sortOrder, not map order, decides the repo array order on the way back', () => {
  const back = fromCmsDisplayTemplate({
    key: 'Shuffled',
    displayName: 'Shuffled',
    isDefault: false,
    settings: {
      second: { displayName: 'Second', editor: 'select', sortOrder: 20, choices: {} },
      first: { displayName: 'First', editor: 'select', sortOrder: 10, choices: {} },
    },
  })
  assert.deepStrictEqual(
    back.settings.map((s) => s.key),
    ['first', 'second']
  )
})

test("upstream's type:'boolean' normalises to checkbox", () => {
  const upstream: RepoDisplayTemplate = {
    key: 'QuoteBlockDisplayTemplate',
    displayName: 'Quote',
    contentType: 'QuoteBlock',
    isDefault: true,
    settings: [{ key: 'bordersRounded', displayName: 'Rounded Borders', type: 'boolean', required: false }],
  }
  const cms = toCmsDisplayTemplate(upstream)
  assert.equal(cms.settings.bordersRounded.editor, 'checkbox')
  const back = fromCmsDisplayTemplate(cms)
  assert.equal(back.settings[0].type, 'checkbox')
  assert.deepStrictEqual(back, stripDefaults(normalizeRepoDisplayTemplate(upstream)))
})

test('measuredKeysOnly drops description and required, and only those', () => {
  const lean = toCmsDisplayTemplate(MIXED, { measuredKeysOnly: true })
  assert.deepStrictEqual(Object.keys(lean.settings.colorScheme).sort(), [
    'choices',
    'displayName',
    'editor',
    'sortOrder',
  ])
  const rich = toCmsDisplayTemplate(MIXED)
  assert.equal(rich.settings.colorScheme.description, 'Palette slot')
  assert.equal(rich.settings.colorScheme.required, true)
})

test('extractDefaults mirrors upstream: explicit value wins, else the first option', () => {
  assert.deepStrictEqual(extractDefaults(STAT_BLOCK.settings), {
    animationMode: 'none',
    extrusionCount: 'layers_5',
    invertExtrusion: 'false',
  })
  assert.deepStrictEqual(
    extractDefaults([
      { key: 'noDefault', options: [{ value: 'first', displayName: 'First' }] },
      { key: 'boolDefault', defaultValue: false },
      { key: 'neither' },
    ]),
    { noDefault: 'first', boolDefault: 'false' }
  )
})

test('extractTemplateDefaults keys by template, resolveDefaultTemplateKey prefers contentType', () => {
  assert.deepStrictEqual(extractTemplateDefaults([MIXED]), {
    CallToActionSettings: { colorScheme: 'default', border: 'false' },
  })
  const templates: RepoDisplayTemplate[] = [
    { key: 'RowDisplayTemplate', displayName: 'Row', nodeType: 'row', isDefault: true, settings: [] },
    { ...STAT_BLOCK },
  ]
  assert.equal(resolveDefaultTemplateKey(templates, { nodeType: 'row' }), 'RowDisplayTemplate')
  assert.equal(
    resolveDefaultTemplateKey(templates, { nodeType: 'row', contentType: 'StatBlock' }),
    'StatBlockDisplayTemplate'
  )
  assert.equal(resolveDefaultTemplateKey(templates, { nodeType: 'column' }), undefined)
})

console.log('')
if (failures.length > 0) {
  console.log(`${passed} passed, ${failures.length} FAILED`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exitCode = 1
} else {
  console.log(`${passed} passed`)
}
