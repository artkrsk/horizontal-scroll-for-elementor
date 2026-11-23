<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use ArtsHorizontalScroll\Arts\Base\Elementor\CacheClear;

/**
 * The one-clear-per-version pass that keeps EXISTING sites correct across an
 * update. Elementor caches generated post CSS and rendered element markup
 * against saved pages; a release that moves the runway or retargets a control
 * selector — 1.2.0 did both — otherwise keeps serving the old pairing until
 * something clears them. arts/base's CacheClear does it, at once here since
 * `elementor/init` has finished by the time a test runs.
 */
class CacheClearTest extends TestCase {

	private const VERSION_OPTION = 'arts_elementor_cache_horizontal-scroll';

	public function set_up(): void {
		parent::set_up();

		// The whole suite is one request, and CacheClear skips the clear once
		// this request has cleared; start each test as a fresh request would.
		// WP_UnitTestCase restores $wp_actions after each test.
		$this->assertIsArray( $GLOBALS['wp_actions'] );
		unset( $GLOBALS['wp_actions']['elementor/core/files/clear_cache'] );
	}

	/** A page carrying both caches Elementor keys off saved posts. */
	private function page_with_both_caches(): int {
		$post_id = self::factory()->post->create( array( 'post_type' => 'page' ) );
		$this->assertIsInt( $post_id );

		update_post_meta( $post_id, '_elementor_css', array( 'status' => 'inline' ) );
		update_post_meta( $post_id, '_elementor_element_cache', array( 'a' => 'cached markup' ) );

		return $post_id;
	}

	private function run_pass(): void {
		CacheClear::on_version( 'horizontal-scroll', ARTS_HORIZONTAL_SCROLL_PLUGIN_VERSION );
	}

	public function test_an_unchanged_version_clears_nothing(): void {
		update_option( self::VERSION_OPTION, ARTS_HORIZONTAL_SCROLL_PLUGIN_VERSION );
		$post_id = $this->page_with_both_caches();

		$this->run_pass();

		$this->assertSame( 0, did_action( 'elementor/core/files/clear_cache' ) );
		$this->assertNotEmpty( get_post_meta( $post_id, '_elementor_css', true ) );
	}

	public function test_an_older_version_clears_both_stores_and_stamps_itself(): void {
		update_option( self::VERSION_OPTION, '0.0.0' );
		$post_id = $this->page_with_both_caches();

		$this->run_pass();

		$this->assertSame( 1, did_action( 'elementor/core/files/clear_cache' ) );
		// Post CSS and element cache both: a markup change invalidates the
		// second, a selector change the first, and a release can carry either.
		$this->assertEmpty( get_post_meta( $post_id, '_elementor_css', true ) );
		$this->assertEmpty( get_post_meta( $post_id, '_elementor_element_cache', true ) );
		$this->assertSame( ARTS_HORIZONTAL_SCROLL_PLUGIN_VERSION, get_option( self::VERSION_OPTION ) );
	}

	public function test_a_site_that_never_stored_a_version_is_cleared_once(): void {
		// The upgrade path from every release before this option existed.
		delete_option( self::VERSION_OPTION );

		$this->run_pass();
		$this->run_pass();

		$this->assertSame( 1, did_action( 'elementor/core/files/clear_cache' ) );
	}
}
