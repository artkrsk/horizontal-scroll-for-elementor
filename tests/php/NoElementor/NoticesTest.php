<?php

namespace Arts\HorizontalScroll\Tests\NoElementor;

use Arts\HorizontalScroll\Managers\Notices;

/**
 * The activation path with Elementor absent. Every path in Notices reads
 * \Elementor\Plugin::$instance past its did_action() guard, so each guard is
 * all that stands between a site that deactivated Elementor with an admin-post
 * URL still open in a tab and a fatal error — and the Integration suite, which
 * always has Elementor loaded, is structurally unable to see it.
 */
class NoticesTest extends \WP_UnitTestCase {

	public function test_activation_writes_nothing_without_elementor(): void {
		$this->assertSame( 0, did_action( 'elementor/loaded' ) );

		$written = array();
		$record  = static function ( $option ) use ( &$written ): void {
			$written[] = $option;
		};
		add_action( 'add_option', $record );
		add_action( 'update_option', $record );

		( new Notices() )->activate_nested_elements();

		remove_action( 'add_option', $record );
		remove_action( 'update_option', $record );

		$this->assertSame( array(), $written );
	}

	public function test_no_notice_is_rendered_without_elementor(): void {
		$user_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$this->assertIsInt( $user_id );
		wp_set_current_user( $user_id );

		ob_start();
		( new Notices() )->maybe_render_activation_notice();

		// The experiments lookup below the guard would fatal, so the guard is
		// the whole of the safety here.
		$this->assertSame( '', (string) ob_get_clean() );
	}
}
