import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { READY_EVENT, TRACK_SELECTOR, WRAPPER_SELECTOR } from '@ts/contract'
import { describe, expect, it } from 'vitest'

/**
 * README's "committed surface" table IS the public API — the file says so, and
 * `window.ARTS_HS.contract` exists to be bumped when it changes. But a table in
 * a markdown file is the one place in this repo nothing executes, so a var
 * could be renamed in the stylesheet, or documented and never shipped, and
 * every other test here would stay green while integrators' CSS broke.
 *
 * Same technique as phpParity.test.ts, one language further out: parse the
 * table, then hold the code to what it promises. Deliberately one-directional —
 * everything documented must exist; the many internal `--arts-hs-*` vars are
 * allowed to stay undocumented, which is exactly what the README's own
 * "don't read vars not listed above" rule depends on.
 */

const README = readFileSync('README.md', 'utf8')

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  )

/**
 * Comments in this repo quote these names constantly — `engine.ts` explains the
 * vertical states "neutralize it through --arts-hs-move: 0", which reads to any
 * search exactly like a declaration. A comment declares nothing.
 */
const withoutComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

/**
 * The stylesheet with its mixin namespace resolved: `--arts-hs-#{$ns}move`
 * compiles to both `--arts-hs-move` and its `--arts-hs-h-` twin, and dropping
 * the interpolation is what makes the emitted name visible to a search.
 */
const STYLESHEET = withoutComments(readFileSync('src/styles/index.scss', 'utf8')).replace(
  /#\{\$ns\}/g,
  ''
)

const TYPESCRIPT = walk('src/ts')
  .filter((file) => file.endsWith('.ts'))
  .map((file) => withoutComments(readFileSync(file, 'utf8')))
  .join('\n')

const SOURCE = [STYLESHEET, TYPESCRIPT].join('\n')

/** The backticked names in the first column of the committed-surface table. */
const documented = (): string[] => {
  const start = README.indexOf('### The committed surface')
  if (start === -1) {
    throw new Error('README has no "The committed surface" table')
  }
  const next = README.indexOf('\n### ', start + 1)
  const table = README.slice(start, next === -1 ? undefined : next)

  const names = table
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|')[1]?.trim() ?? '')
    // The header row and the |---|---| separator carry no backticks.
    .flatMap((cell) => cell.match(/`[^`]+`/g) ?? [])
    .map((token) => token.slice(1, -1))

  if (names.length === 0) {
    throw new Error('the committed-surface table parsed to nothing — has its shape changed?')
  }
  return names
}

const NAMES = documented()
/** Not a custom property but a timeline name — it has its own assertion below. */
const TIMELINE = '--arts-hs'
const VARS = NAMES.filter((name) => name.startsWith('--') && name !== TIMELINE)
const CLASSES = NAMES.filter((name) => name.startsWith('.'))

/**
 * DECLARED, not merely mentioned. A `var(--x, fallback)` read proves nothing
 * about whether anything ever sets `--x` — and a half-finished rename leaves
 * exactly those reads behind. A declaration is `--x:` in the stylesheet, or the
 * quoted name a module hands setProperty.
 */
const declares = (name: string): boolean =>
  new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(STYLESHEET) ||
  TYPESCRIPT.includes(`'${name}'`)

describe('the committed surface parses', () => {
  it('lists the names this suite goes on to check', () => {
    // A restructured table that stopped yielding names would otherwise leave
    // every it.each below silently asserting nothing.
    expect(VARS.length).toBeGreaterThan(5)
    expect(CLASSES).toEqual(['.arts-hs', WRAPPER_SELECTOR, TRACK_SELECTOR])
  })
})

describe('every custom property the README commits to', () => {
  it.each(VARS)('%s is something the plugin actually sets', (name) => {
    expect(declares(name)).toBe(true)
  })
})

describe('the names the README and the code both spell out', () => {
  it('binds the timeline the recipes tell integrators to bind', () => {
    // The one entry that is a timeline name rather than a custom property:
    // integrators write `animation-timeline: --arts-hs`, so the stylesheet has
    // to be the thing declaring it.
    expect(SOURCE).toContain('view-timeline: --arts-hs block')
  })

  it('dispatches the readiness event under its documented name', () => {
    expect(NAMES).toContain(READY_EVENT)
  })

  it('exposes getTimeline on the documented global', () => {
    expect(NAMES).toContain('window.ARTS_HS.getTimeline(el)')
    expect(SOURCE).toMatch(/window\.ARTS_HS = \{[^}]*getTimeline/)
  })

  it('ships the API level the README says it is at', () => {
    // "currently `1`" in the prose above the table, `contract: 1` in the entry.
    const documentedLevel = README.match(/`window\.ARTS_HS\.contract` \(currently `(\d+)`\)/)
    const shipped = SOURCE.match(/contract: (\d+)/)

    expect(documentedLevel?.[1]).toBeDefined()
    expect(shipped?.[1]).toBe(documentedLevel?.[1])
  })

  it('opens and closes the pin range where the README says it does', () => {
    // The range pair integrators write into animation-range, and the same pair
    // the engine hands the polyfill's WAAPI surface.
    expect(NAMES).toContain('contain 0%')
    expect(NAMES).toContain('contain 100%')
    expect(SOURCE).toContain('animation-range: contain 0% contain 100%')
    expect(SOURCE).toMatch(/rangeStart: 'contain 0%'/)
    expect(SOURCE).toMatch(/rangeEnd: 'contain 100%'/)
  })
})
