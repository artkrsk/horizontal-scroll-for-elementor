<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Widgets\HorizontalScroll;
use Elementor\Core\Experiments\Manager as Experiments_Manager;

/**
 * The fixtures every Integration test builds on. Nothing here asserts anything
 * about the plugin — these only reach past Elementor's own ceremony to the
 * widget, its controls and its markup, failing the calling test by name when
 * that ceremony does not hold up.
 */
abstract class TestCase extends \WP_UnitTestCase {

	protected function widget(): HorizontalScroll {
		$widget = \Elementor\Plugin::$instance->widgets_manager->get_widget_types( 'arts-horizontal-scroll' );

		$this->assertInstanceOf( HorizontalScroll::class, $widget );

		return $widget;
	}

	/**
	 * Controls as the CSS generator and the editor read them: Optimized Control
	 * Loading files every control carrying `selectors` into a separate
	 * style_controls stack, and get_controls() merges it back only under this
	 * flag.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	protected function controls(): array {
		\Elementor\Core\Frontend\Performance::set_use_style_controls( true );
		$controls = $this->widget()->get_controls();
		\Elementor\Core\Frontend\Performance::set_use_style_controls( false );

		$this->assertIsArray( $controls );

		/** @var array<string, array<string, mixed>> $controls */
		return $controls;
	}

	/**
	 * @param array<int, array<string, string>> $panels
	 */
	protected function render_widget( string $id, array $panels ): string {
		$widget = \Elementor\Plugin::$instance->elements_manager->create_element_instance(
			array(
				'id'         => $id,
				'elType'     => 'widget',
				'widgetType' => 'arts-horizontal-scroll',
				'settings'   => array( 'panels' => $panels ),
				'elements'   => array(),
			)
		);

		$this->assertInstanceOf( HorizontalScroll::class, $widget );

		ob_start();
		$widget->print_element();

		return (string) ob_get_clean();
	}

	/** @return array<int, array<string, string>> */
	protected function panels( int $count ): array {
		$panels = array();
		for ( $i = 1; $i <= $count; $i++ ) {
			$panels[] = array(
				'_id'         => 'p' . $i,
				'panel_title' => 'Panel ' . $i,
			);
		}

		return $panels;
	}

	/**
	 * @param mixed $value
	 * @return array<mixed, mixed>
	 */
	protected function array_value( $value ): array {
		$this->assertIsArray( $value );

		return $value;
	}

	/** @param mixed $value */
	protected function string_value( $value ): string {
		$this->assertIsString( $value );

		return $value;
	}

	/**
	 * Run assertions with an Elementor experiment forced to a given state.
	 *
	 * The experiment's saved state is baked into the features array at init, so
	 * only the `default` is reachable at runtime — and only while nothing has
	 * been saved over it. Assert that precondition rather than silently
	 * asserting against whichever state the environment happens to be in.
	 *
	 * @param callable(): void $assertions
	 */
	protected function with_feature_default_state( string $feature, string $state, callable $assertions ): void {
		$experiments = \Elementor\Plugin::$instance->experiments;

		$registered = $experiments->get_features( $feature );
		$this->assertIsArray( $registered, $feature . ' is not registered' );
		$this->assertSame(
			Experiments_Manager::STATE_DEFAULT,
			$registered['state'] ?? null,
			$feature . ' has a saved state in this environment; the default is ignored and this test cannot pin it'
		);

		$original = $registered['default'] ?? Experiments_Manager::STATE_DEFAULT;
		$this->assertIsString( $original );

		$experiments->set_feature_default_state( $feature, $state );

		try {
			$this->assertSame(
				Experiments_Manager::STATE_ACTIVE === $state,
				$experiments->is_feature_active( $feature )
			);
			$assertions();
		} finally {
			$experiments->set_feature_default_state( $feature, $original );
		}
	}
}
