#!/usr/bin/env node
/**
 * Extract a version's changelog entry from readme.txt.
 *
 * Usage:
 *   node dev/extract-changelog.js            # latest entry
 *   node dev/extract-changelog.js 1.2.0      # specific version
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const readme = readFileSync(resolve('src/wordpress-plugin/readme.txt'), 'utf8')
const version = process.argv[2] ?? 'latest'

const section = readme.match(/== Changelog ==([\s\S]+?)(?:\n== |$)/)
if (!section) {
  console.error('No changelog section found in readme.txt')
  process.exit(1)
}

const entries = section[1]
  .split(/(?=^= [\d.]+)/m)
  .map((entry) => entry.trim())
  .filter(Boolean)

if (entries.length === 0) {
  console.error('No changelog entries found')
  process.exit(1)
}

const entry =
  version === 'latest' ? entries[0] : entries.find((e) => e.startsWith(`= ${version} =`))

if (!entry) {
  console.error(`No changelog entry for version ${version}`)
  process.exit(1)
}

console.log(entry)
