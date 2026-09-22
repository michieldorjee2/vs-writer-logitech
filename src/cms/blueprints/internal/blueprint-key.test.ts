/// <reference types="node" />
/**
 * Proof that the pure MD5 in `blueprint-key.ts` is the same function as `node:crypto`'s.
 *
 *   npx tsx src/cms/blueprints/internal/blueprint-key.test.ts
 *
 * This is the claim that makes reimplementing MD5 acceptable: `client.ts` computes a
 * blueprint's key with `createHash('md5')` and a blueprint module computes it without Node,
 * and if the two ever disagreed, `apply.ts` would create a second blueprint beside the one it
 * was supposed to update — silently, because both keys are valid GUIDs.
 *
 * Self-contained, like `display-template-transform.test.ts`: this repo has no test runner.
 */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import { blueprintKeyFor, md5Hex } from './blueprint-key'

const reference = (input: string): string =>
  createHash('md5').update(input, 'utf8').digest('hex')

const CASES = [
  // The four real blueprint ids. These are the values that end up in the CMS.
  'abm-takeout',
  'use-case-default',
  'comparison',
  'person',
  // Edges: empty, exactly one block short of padding, exactly one block, multi-block.
  '',
  'a',
  'abc',
  'message digest',
  'x'.repeat(55),
  'x'.repeat(56),
  'x'.repeat(57),
  'x'.repeat(63),
  'x'.repeat(64),
  'x'.repeat(65),
  'x'.repeat(1000),
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  // Multi-byte UTF-8, including a surrogate pair — the encoder is hand-rolled too.
  'Siemens Energy — Optimizely',
  'naïve café',
  '日本語',
  'emoji 🙂 and more 🚀',
]

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

console.log('blueprint-key')

for (const input of CASES) {
  const label = input.length > 24 ? `${input.slice(0, 21)}… (${input.length} chars)` : `'${input}'`
  test(`md5Hex matches node:crypto for ${label}`, () => {
    assert.equal(md5Hex(input), reference(input))
  })
}

test('the published RFC 1321 vectors', () => {
  assert.equal(md5Hex(''), 'd41d8cd98f00b204e9800998ecf8427e')
  assert.equal(md5Hex('a'), '0cc175b9c0f1b6a831c399e269772661')
  assert.equal(md5Hex('abc'), '900150983cd24fb0d6963f7d28e17f72')
  assert.equal(md5Hex('message digest'), 'f96b697d7cb7938d525a2f31aaf161d0')
  assert.equal(
    md5Hex('12345678901234567890123456789012345678901234567890123456789012345678901234567890'),
    '57edf4a22be3c955ac49da2e2107b67a'
  )
})

test('a key is 32 lowercase hex characters, which is what the API demands', () => {
  for (const id of ['abm-takeout', 'use-case-default', 'comparison', 'person']) {
    assert.match(blueprintKeyFor(id), /^[0-9a-f]{32}$/)
  }
})

test('the same id always resolves to the same key, and different ids do not collide', () => {
  assert.equal(blueprintKeyFor('abm-takeout'), blueprintKeyFor('abm-takeout'))
  const keys = ['abm-takeout', 'use-case-default', 'comparison', 'person'].map(blueprintKeyFor)
  assert.equal(new Set(keys).size, keys.length)
})

console.log('')
if (failures.length > 0) {
  console.log(`${passed} passed, ${failures.length} FAILED`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exitCode = 1
} else {
  console.log(`${passed} passed`)
}
