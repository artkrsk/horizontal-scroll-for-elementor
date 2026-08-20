<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Widgets\HorizontalScroll;
use Elementor\Core\Experiments\Manager as Experiments_Manager;

/**
 * Core renders `.elementor-widget-container` from has_widget_inner_wrapper()
 * in every state, but pairs the matching Advanced-tab selector set with it
 * only while `e_optimized_markup` is active. 1.1.0 forced the flag to false
 * (the root was the pin runway) and shipped a dead Advanced tab on every site
 * with the experiment off. The runway is now the widget's own inner div and
 * the flag is core's to decide — this pins markup and selectors agreeing in
 * both states, whichever way core decides.
 */
class AdvancedTabTest extends TestCase {

	private const FEATURE = 'e_optimized_markup';

	/** @return array<string, array<string, mixed>> */
	private function controls(): array {
		$widget = \Elementor\Plugin::$instance->widgets_manager->get_widget_types( 'arts-horizontal-scroll' );
		$this->assertInstanceOf( HorizontalScroll::class, $widget );

		// Controls carrying `selectors` live in the separate style_controls
		// stack under Optimized Control Loading — the CSS generator's own
		// read path (see ControlsTest).
		\Elementor\Core\Frontend\Performance::set_use_style_controls( true );
		$controls = $widget->get_controls();
		\Elementor\Core\Frontend\Performance::set_use_style_controls( false );

		$this->assertIsArray( $controls );

		/** @var array<string, array<string, mixed>> $controls */
		return $controls;
	}

	private function render(): string {
		$widget = \Elementor\Plugin::$instance->elements_manager->create_element_instance(
			array(
				'id'         => 'ahsAdv',
				'elType'     => 'widget',
				'widgetType' => 'arts-horizontal-scroll',
				'settings'   => array(
					'panels' => array(
						array(
							'_id'         => 'p1',
							'panel_title' => 'Panel 1',
						),
					),
				),
				'elements'   => array(),
			)
		);

		$this->assertInstanceOf( HorizontalScroll::class, $widget );

		ob_start();
		$widget->print_element();

		return (string) ob_get_clean();
	}

	/**
	 * The experiment's saved state is baked into the features array at init,
	 * so only the `default` is reachable at runtime — and only while nothing
	 * has been saved over it. Assert that precondition rather than silently
	 * asserting against whichever state the environment happens to be in: a
	 * fresh wp-env is >= 3.30, where the default is ACTIVE and the bug this
	 * guards would not reproduce at all.
	 *
	 * @param callable(): void $assertions
	 */
	private function with_optimized_markup( string $state, callable $assertions ): void {
		$experiments = \Elementor\Plugin::$instance->experiments;

		$feature = $experiments->get_features( self::FEATURE );
		$this->assertIsArray( $feature, self::FEATURE . ' is not registered' );
		$this->assertSame(
			Experiments_Manager::STATE_DEFAULT,
			$feature['state'] ?? null,
			self::FEATURE . ' has a saved state in this environment; the default is ignored and this test cannot pin it'
		);

		$original = $feature['default'] ?? Experiments_Manager::STATE_DEFAULT;
		$this->assertIsString( $original );

		$experiments->set_feature_default_state( self::FEATURE, $state );

		try {
			$this->assertSame( Experiments_Manager::STATE_ACTIVE === $state, $experiments->is_feature_active( self::FEATURE ) );
			$assertions();
		} finally {
			$experiments->set_feature_default_state( self::FEATURE, $original );
		}
	}

	/** Whether any merged control selector targets the inner wrapper. */
	private function selectors_target_inner_wrapper(): bool {
		foreach ( $this->controls() as $control ) {
			$selectors = is_array( $control['selectors'] ?? null ) ? array_keys( $control['selectors'] ) : array();
			// Group controls keep the un-expanded target here too.
			if ( is_string( $control['selector'] ?? null ) ) {
				$selectors[] = $control['selector'];
			}
			foreach ( $selectors as $selector ) {
				if ( false !== strpos( (string) $selector, '.elementor-widget-container' ) ) {
					return true;
				}
			}
		}

		return false;
	}

	private function assert_markup_and_selectors_agree(): void {
		$rendered = false !== strpos( $this->render(), 'elementor-widget-container' );

		$this->assertSame(
			$rendered,
			$this->selectors_target_inner_wrapper(),
			$rendered
				? 'The inner wrapper is rendered but no Advanced-tab selector targets it'
				: 'Advanced-tab selectors target an inner wrapper that is not rendered'
		);
	}

	public function test_markup_and_selectors_agree_with_the_experiment_off(): void {
		// The 1.1.0 regression case: the default on sites installed before 3.30.
		$this->with_optimized_markup(
			Experiments_Manager::STATE_INACTIVE,
			function (): void {
				$this->assert_markup_and_selectors_agree();
			}
		);
	}

	public function test_markup_and_selectors_agree_with_the_experiment_on(): void {
		$this->with_optimized_markup(
			Experiments_Manager::STATE_ACTIVE,
			function (): void {
				$this->assert_markup_and_selectors_agree();
			}
		);
	}
}
