<?php
/**
 * PHPUnit bootstrap — runs INSIDE the wp-env tests-cli container.
 *
 * `wp-env start` generates the tests config this file requires via
 * WP_PHPUNIT__TESTS_CONFIG (set in phpunit.xml). The suite loads the BUILT
 * plugin from wp-content/plugins (the dist/ mount), never the repo source
 * tree — the SmokeTest pins that autoloader precedence.
 */

require dirname( __DIR__ ) . '/vendor/autoload.php';

$ahs_wp_phpunit_dir = getenv( 'WP_PHPUNIT__DIR' );
$ahs_tests_config   = getenv( 'WP_PHPUNIT__TESTS_CONFIG' );

if ( false === $ahs_wp_phpunit_dir || ! is_dir( $ahs_wp_phpunit_dir ) ) {
	fwrite( STDERR, "WP_PHPUNIT__DIR is not available — run `composer install` first.\n" );
	exit( 1 );
}

if ( false === $ahs_tests_config || ! file_exists( $ahs_tests_config ) ) {
	fwrite( STDERR, "Tests config not found — run through wp-env: `pnpm test` (or `pnpm exec wp-env start`, then `pnpm test:php`).\n" );
	exit( 1 );
}

require $ahs_wp_phpunit_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function (): void {
		// One gate, two suites: the full combo, and nothing-but-the-plugin —
		// which proves the shell boots inert when Elementor is absent even
		// though `Requires Plugins` shields real sites from that state.
		$ahs_without_elementor = '1' === getenv( 'AHS_TESTS_WITHOUT_ELEMENTOR' );

		if ( ! $ahs_without_elementor ) {
			require WP_PLUGIN_DIR . '/elementor/elementor.php';
		}

		require WP_PLUGIN_DIR . '/horizontal-scroll-for-elementor/horizontal-scroll-for-elementor.php';
	}
);

require $ahs_wp_phpunit_dir . '/includes/bootstrap.php';
