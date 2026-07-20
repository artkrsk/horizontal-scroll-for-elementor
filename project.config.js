import process from 'node:process'

export default {
  slug: 'horizontal-scroll-for-elementor',
  entry: {
    ts: './src/ts/index.ts',
    sass: './src/scss/index.scss',
    editor: './src/ts/editor/index.ts',
    // No polyfill entry: arts/scroll-timeline-polyfill ships (and patches) it,
    // so a page running several Arts plugins installs exactly one copy.
    polyfill: null
  },
  paths: { php: './src/php', plugin: './src/wordpress-plugin', dist: './dist' },
  // Machine-specific: the Local site's plugin dir, from the gitignored .env (DEV_TARGET)
  devTarget: process.env.DEV_TARGET ?? null,
  esbuildTarget: 'es2018',
  versionConstant: 'ARTS_HORIZONTAL_SCROLL_PLUGIN_VERSION',
  vendor: { autoloaderOnly: true }
}
