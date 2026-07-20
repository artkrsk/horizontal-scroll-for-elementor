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

		$notices = new Notices();
		$notices->activate_nested_elements();

		// Container carries the real dependency chain on current Elementor
		// (nested-elements is immutable there and re-derives from it); the
		// nested-elements write is the defensive leg for older cores.
		$this->assertSame( 'active', get_option( $container_key ) );
		$this->assertSame( 'active', get_option( $nested_key ) );
	}
}
