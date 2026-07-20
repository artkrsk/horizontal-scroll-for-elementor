#!/usr/bin/env node
/**
 * Generates .wordpress-org/blueprints/blueprint.json — the wp.org Live Preview blueprint.
 *
 * Self-contained by design: the seed script is inlined as a writeFile step rather than
 * fetched. wp.org's SVN serves no CORS headers so a blueprint cannot pull its own assets
 * back down, and a GitHub-raw dependency would put the live preview at the mercy of a repo
 * URL plus a tag bump every release.
 *
 * The release workflow copies .wordpress-org/ into SVN assets/ wholesale, so the
 * blueprints/ subdir needs no build wiring of its own — run this manually after editing
 * dev/seed/demo-page.php and commit the regenerated blueprint.json.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../../.wordpress-org/blueprints/blueprint.json', import.meta.url))
const seed = readFileSync(new URL('../seed/demo-page.php', import.meta.url), 'utf8')

// Single source of truth for the page id: the landingPage and the seeder cannot drift.
const pageId = seed.match(/define\(\s*'AHS_DEMO_PAGE_ID',\s*(\d+)\s*\)/)?.[1]

if (!pageId) {
  console.error('build-blueprint: could not read AHS_DEMO_PAGE_ID out of dev/seed/demo-page.php')
  process.exit(1)
}

const blueprint = {
  $schema: 'https://playground.wordpress.net/blueprint-schema.json',
  landingPage: `/wp-admin/post.php?post=${pageId}&action=elementor`,
  preferredVersions: { php: '8.1', wp: 'latest' },
  // Required: without it the wordpress.org plugin/theme installs fail on CORS.
  features: { networking: true },
  login: true,
  steps: [
    {
      step: 'installPlugin',
      pluginData: { resource: 'wordpress.org/plugins', slug: 'elementor' },
      options: { activate: true }
    },
    {
      step: 'installTheme',
      themeData: { resource: 'wordpress.org/themes', slug: 'hello-elementor' },
      options: { activate: true }
    },
    { step: 'writeFile', path: '/wordpress/wp-content/ahs-demo-seed.php', data: seed },
    {
      step: 'runPHP',
      code: "<?php require_once '/wordpress/wp-load.php'; require '/wordpress/wp-content/ahs-demo-seed.php';"
    }
  ]
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify(blueprint, null, 2)}\n`)

console.log(
  `blueprint:build OK — ${OUT} (${(JSON.stringify(blueprint).length / 1024).toFixed(1)} KB, page id ${pageId})`
)
