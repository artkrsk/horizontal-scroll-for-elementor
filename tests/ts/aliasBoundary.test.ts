import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The `@ts/*` alias is a test-side convenience mapped in tsconfig and the
 * shared vitest config — nothing the plugin bundle ever sees. esbuild builds
 * src/ts straight from source with its own config and no alias resolution, so
 * a single aliased import inside src/ts would break the build while this suite
 * kept passing. This is the mechanical guard on that boundary.
 */

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  )

describe('the alias boundary', () => {
  it('keeps the @ts alias out of shipped source', () => {
    const offenders = walk('src/ts')
      .filter((file) => file.endsWith('.ts'))
      .filter((file) => /from '@ts\//.test(readFileSync(file, 'utf-8')))

    expect(offenders).toEqual([])
  })
})
