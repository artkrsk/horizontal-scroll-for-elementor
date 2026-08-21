<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Managers\Elementor as ElementorManager;

/**
 * The one-clear-per-version pass that keeps EXISTING sites correct across an
 * update. Elementor caches generated post CSS and rendered element markup
 * against saved pages; a release that moves the runway or retargets a control
 * selector — 1.1.0 did both — otherwise keeps serving the old pairing until
 * something clears them. Nothing exercised either branch: the callback runs
 * once during bootstrap, when the option already matches, so the clear path had
 * never executed at all.
 */
class CacheClearTest extends TestCase {

	private const VERSION_OPTION = 'arts_horizontal_scroll_version';

	/** A page carrying both caches Elementor keys off saved posts. */
	private function page_with_both_caches(): int {
		$post_id = self::factory()->post->create( array( 'post_type' => 'page' ) );
		$this->assertIsInt( $post_id );

		update_post_meta( $post_id, '_elementor_css', array( 'status' => 'inline' ) );
		update_post_meta( $post_id, '_elementor_element_cache', array( 'a' => 'cached markup' ) );

		return $post_id;
	}

	private function run_pass(): void {
		( new ElementorManager() )->maybe_clear_cache_on_version_change();
	}

	public function test_an_unchanged_version_clears_nothing(): void {
		update_option( self::VERSION_OPTION, ARTS_HORIZONTAL_SCROLL_PLUGIN_VERSION );
		$post_id = $this->page_with_both_caches();
		$before  = did_action( 'elementor/core/files/clear_cache' );

		$this->run_pass();

		$this->assertSame( $before, did_action( 'elementor/core/files/clear_cache' ) );
		$this->assertNotEmpty( get_post_meta( $post_id, '_elementor_css', true ) );
	}

	public function test_an_older_version_clears_both_stores_and_stamps_itself(): void {
		update_option( self::VERSION_OPTION, '0.0.0' );
		$post_id = $this->page_with_both_caches();
		$before  = did_action( 'elementor/core/files/clear_cache' );

		$this->run_pass();

		$this->assertSame( $before + 1, did_action( 'elementor/core/files/clear_cache' ) );
		// Post CSS and element cache both: a markup change invalidates the
		// second, a selector change the first, and a release can carry either.
		$this->assertEmpty( get_post_meta( $post_id, '_elementor_css', true ) );
		$this->assertEmpty( get_post_meta( $post_id, '_elementor_element_cache', true ) );
		$this->assertSame( ARTS_HORIZONTAL_SCROLL_PLUGIN_VERSION, get_option( self::VERSION_OPTION ) );
	}

	public function test_a_site_that_never_stored_a_version_is_cleared_once(): void {
		// The upgrade path from every release before this option existed.
		delete_option( self::VERSION_OPTION );
		$before = did_action( 'elementor/core/files/clear_cache' );

		$this->run_pass();
		$this->run_pass();

		$this->assertSame( $before + 1, did_action( 'elementor/core/files/clear_cache' ) );
	}
}
