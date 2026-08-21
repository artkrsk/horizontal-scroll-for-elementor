<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Managers\Elementor as ElementorManager;
use Arts\HorizontalScroll\Managers\Notices;
use Elementor\Core\Experiments\Manager as Experiments_Manager;

/**
 * What the plugin does when its one hard requirement is switched off.
 *
 * Nested Elements ships default-on, so every other test here runs the healthy
 * path — and the degrade is three separate decisions in three files: the
 * manager declines to register, the widget hides itself, and the notice offers
 * the one-click fix. None of them had ever executed under test, which is a poor
 * place for a plugin whose whole value proposition is one widget.
 */
class NestedElementsOffTest extends TestCase {

	private const FEATURE = 'nested-elements';

	/** @param callable(): void $assertions */
	private function without_nested_elements( callable $assertions ): void {
		$this->with_feature_default_state( self::FEATURE, Experiments_Manager::STATE_INACTIVE, $assertions );
	}

	private function log_in_as( string $role ): void {
		$user_id = self::factory()->user->create( array( 'role' => $role ) );
		$this->assertIsInt( $user_id );

		wp_set_current_user( $user_id );
	}

	public function test_the_widget_is_not_registered(): void {
		$this->without_nested_elements(
			function (): void {
				// Versions predating the experiment would fatal on the widget's
				// parent class, so the degrade has to be "no widget", never a
				// widget that reports itself broken.
				$widgets_manager = $this->createMock( \Elementor\Widgets_Manager::class );
				$widgets_manager->expects( $this->never() )->method( 'register' );

				( new ElementorManager() )->register_widgets( $widgets_manager );
			}
		);
	}

	public function test_the_widget_hides_itself_from_the_panel(): void {
		$this->without_nested_elements(
			function (): void {
				$widget = $this->widget();
				$method = new \ReflectionMethod( $widget, 'show_in_panel' );
				$method->setAccessible( true );

				$this->assertFalse( $method->invoke( $widget ) );
			}
		);
	}

	public function test_the_notice_offers_a_nonced_one_click_fix(): void {
		$this->log_in_as( 'administrator' );

		$this->without_nested_elements(
			function (): void {
				ob_start();
				do_action( 'admin_notices' );
				$output = (string) ob_get_clean();

				$this->assertStringContainsString( 'notice-warning', $output );
				// The button posts to admin-post, where handle_activation()
				// re-checks both the capability and this nonce.
				$this->assertStringContainsString( 'action=' . Notices::ACTIVATE_ACTION, $output );
				$this->assertStringContainsString( '_wpnonce=', $output );
			}
		);
	}

	public function test_no_notice_reaches_a_user_who_could_not_act_on_it(): void {
		$this->log_in_as( 'editor' );

		$this->without_nested_elements(
			function (): void {
				ob_start();
				do_action( 'admin_notices' );

				$this->assertStringNotContainsString( Notices::ACTIVATE_ACTION, (string) ob_get_clean() );
			}
		);
	}
}
