<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Managers\Notices;

/**
 * The plugin's only state-changing request. handle_activation() flips two
 * Elementor experiments from an admin-post URL, which makes its capability
 * check and its nonce the whole of its security — and neither had ever run:
 * the suite asserted the hook was registered and stopped there.
 *
 * wp_die() and the redirect both end the request in production; wp-phpunit
 * turns the first into a WPDieException, and the second is short-circuited by
 * throwing from the wp_redirect filter before the exit() behind it.
 */
class ActivationRequestTest extends TestCase {

	private const REDIRECTED = 'redirected to ';

	private function log_in_as( string $role ): void {
		$user_id = self::factory()->user->create( array( 'role' => $role ) );
		$this->assertIsInt( $user_id );

		wp_set_current_user( $user_id );
	}

	/** Nonces are user-scoped, so this only means anything after logging in. */
	private function present_a_valid_nonce(): void {
		$_REQUEST['_wpnonce'] = wp_create_nonce( Notices::ACTIVATE_ACTION );
	}

	/** The location handle_activation() sent the browser to. */
	private function capture_redirect(): string {
		add_filter( 'wp_redirect', array( $this, 'abort_before_exit' ) );

		try {
			( new Notices() )->handle_activation();
		} catch ( \RuntimeException $e ) {
			return str_replace( self::REDIRECTED, '', $e->getMessage() );
		} finally {
			remove_filter( 'wp_redirect', array( $this, 'abort_before_exit' ) );
		}

		$this->fail( 'handle_activation() returned without redirecting' );
	}

	/**
	 * wp_redirect() sends headers and hands straight back to the exit() behind
	 * it, which would take the test runner with it. Carry the location out as
	 * an exception instead, from the last point the request is still ours.
	 *
	 * The empty case returns, because wp_redirect() bails on an empty location
	 * without ever reaching that exit — there is nothing to intercept there,
	 * and a filter that can only throw is a filter that lies about its contract.
	 */
	public function abort_before_exit( string $location ): string {
		if ( '' !== $location ) {
			throw new \RuntimeException( self::REDIRECTED . $location );
		}

		return $location;
	}

	public function tear_down(): void {
		unset( $_REQUEST['_wpnonce'] );

		parent::tear_down();
	}

	public function test_a_user_without_the_capability_is_refused(): void {
		$this->log_in_as( 'editor' );
		$this->present_a_valid_nonce();

		try {
			( new Notices() )->handle_activation();
			$this->fail( 'an editor was allowed to change Elementor features' );
		} catch ( \WPDieException $e ) {
			$this->assertSame( 403, $e->getCode() );
		}
	}

	public function test_a_request_without_a_valid_nonce_is_refused(): void {
		$this->log_in_as( 'administrator' );
		$_REQUEST['_wpnonce'] = 'not-a-nonce';

		$this->expectException( \WPDieException::class );

		( new Notices() )->handle_activation();
	}

	public function test_an_authorised_request_activates_both_features_and_returns(): void {
		$experiments   = \Elementor\Plugin::$instance->experiments;
		$container_key = $experiments->get_feature_option_key( 'container' );
		$nested_key    = $experiments->get_feature_option_key( 'nested-elements' );
		delete_option( $container_key );
		delete_option( $nested_key );

		$this->log_in_as( 'administrator' );
		$this->present_a_valid_nonce();

		$location = $this->capture_redirect();

		$this->assertSame( 'active', get_option( $container_key ) );
		$this->assertSame( 'active', get_option( $nested_key ) );
		// No referer in a test request, so the fallback is what lands.
		$this->assertSame( admin_url(), $location );
	}
}
