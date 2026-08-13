import process from 'node:process'

export default {
  slug: 'horizontal-scroll-for-elementor',
  versionConstant: 'ARTS_HORIZONTAL_SCROLL_PLUGIN_VERSION',
  defineKey: '__ARTS_HORIZONTAL_SCROLL_VERSION__',
  esbuildTarget: 'es2018',
  entry: { ts: './src/ts/index.ts', sass: './src/styles/index.scss' },
  bundles: [
    {
      name: 'editor',
      entry: './src/ts/editor/index.ts',
      outFile: 'horizontal-scroll-for-elementor-editor.js',
      sourcemap: true
    }
  ],
  bannerLines: [],
  zip: { budgetMb: 0.5 },
  paths: { php: './src/php', plugin: './src/wordpress-plugin', dist: './dist' },
  // Machine-specific: the Local site's plugin dir, from the gitignored .env (DEV_TARGET)
  devTarget: process.env.DEV_TARGET ?? null,
  // null = derived from the slug — the old runner already derived it the same way
  vendor: { autoloaderOnly: true, autoloaderSuffix: null },
  // wp.org Live Preview: the editor is where this plugin shows itself
  blueprint: { seed: './dev/seed/demo-page.php', landing: 'editor', extraPlugins: [] }
}
