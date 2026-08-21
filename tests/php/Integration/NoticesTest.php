<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Managers\Notices;

class NoticesTest extends TestCase {

	public function test_activation_hooks_are_registered(): void {
		$this->assertNotFalse( has_action( 'admin_notices' ) );
		$this->assertNotFalse( has_action( 'admin_post_' . Notices::ACTIVATE_ACTION ) );
	}

	public function test_no_notice_renders_while_nested_elements_is_active(): void {
		// The wp-env stack runs with the feature in its default-active state.
		$user_id = self::factory()->user->create( array( 'role' => 'administrator' ) );
		$this->assertIsInt( $user_id );
		wp_set_current_user( $user_id );

		ob_start();
		do_action( 'admin_notices' );
		$output = (string) ob_get_clean();

		$this->assertStringNotContainsString( Notices::ACTIVATE_ACTION, $output );
	}

	public function test_activation_writes_both_feature_options_container_first(): void {
		$experiments   = \Elementor\Plugin::$instance->experiments;
		$container_key = $experiments->get_feature_option_key( 'container' );
		$nested_key    = $experiments->get_feature_option_key( 'nested-elements' );

		delete_option( $container_key );
		delete_option( $nested_key );

		$written = array();
		$record  = static function ( $option ) use ( &$written ): void {
			$written[] = $option;
		};
		add_action( 'add_option', $record );
		add_action( 'update_option', $record );

		$notices = new Notices();
		$notices->activate_nested_elements();

		remove_action( 'add_option', $record );
		remove_action( 'update_option', $record );

		// Container carries the dependency chain — while it is off, Elementor
		// re-derives nested-elements as inactive on every load. nested-elements
		// is an ordinary mutable feature though, so it needs its own write too.
		$this->assertSame( 'active', get_option( $container_key ) );
		$this->assertSame( 'active', get_option( $nested_key ) );

		// Order is load-bearing, and both-are-active cannot see it: written the
		// other way round, Elementor's own dependency validation throws and
		// wp_die()s the request.
		$ours = array();
		foreach ( $written as $option ) {
			if ( in_array( $option, array( $container_key, $nested_key ), true ) && ! in_array( $option, $ours, true ) ) {
				$ours[] = $option;
			}
		}

		$this->assertSame( array( $container_key, $nested_key ), $ours );
	}
}
