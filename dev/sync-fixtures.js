/**
 * Syncs dev/mu-plugins → the dev site's wp-content/mu-plugins. The target is derived
 * from the same build config the plugin sync uses (devTarget), so there is
 * exactly one place that knows where the Local site lives.
 */
import { cp, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

try {
  process.loadEnvFile()
} catch {
  // No .env — fine; the guard below reports the missing DEV_TARGET.
}

// Imported after the env load on purpose: project.config.js reads DEV_TARGET when
// evaluated, and a static import would be hoisted above loadEnvFile().
const { default: config } = await import('../project.config.js')

const devDir = path.dirname(fileURLToPath(import.meta.url))
const pluginTarget = config.devTarget

if (!pluginTarget) {
  console.error('sync-fixtures: no devTarget configured in project.config.js')
  process.exit(1)
}

// wp-content/plugins/<slug> → wp-content/mu-plugins
const muTarget = path.resolve(pluginTarget, '../../mu-plugins')
const source = path.join(devDir, 'mu-plugins')

await mkdir(muTarget, { recursive: true })
await cp(source, muTarget, { recursive: true })
console.log(`sync-fixtures: dev/mu-plugins → ${muTarget}`)
