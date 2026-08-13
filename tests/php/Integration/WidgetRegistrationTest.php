<?php

namespace Arts\HorizontalScroll\Tests\Integration;

use Arts\HorizontalScroll\Widgets\HorizontalScroll;

class WidgetRegistrationTest extends TestCase {

	private function widget(): HorizontalScroll {
		$widget = \Elementor\Plugin::$instance->widgets_manager->get_widget_types( 'arts-horizontal-scroll' );

		$this->assertInstanceOf( HorizontalScroll::class, $widget );

		return $widget;
	}

	public function test_widget_is_registered(): void {
		$widgets = \Elementor\Plugin::$instance->widgets_manager->get_widget_types();

		$this->assertIsArray( $widgets );
		$this->assertArrayHasKey( 'arts-horizontal-scroll', $widgets );
	}

	public function test_nested_elements_experiment_is_active_in_harness(): void {
		$this->assertTrue(
			\Elementor\Plugin::$instance->experiments->is_feature_active( 'nested-elements', true )
		);
	}

	public function test_show_in_panel_delegates_to_nested_elements_experiment(): void {
		$widget = $this->widget();

		$method = new \ReflectionMethod( $widget, 'show_in_panel' );
		$method->setAccessible( true );

		$this->assertSame(
			\Elementor\Plugin::$instance->experiments->is_feature_active( 'nested-elements', true ),
			$method->invoke( $widget )
		);
	}

	public function test_widget_has_no_inner_wrapper(): void {
		// An inner .elementor-widget-container between the pin ({{WRAPPER}}) and the
		// sticky track would become the sticky containing block and break the pin.
		$this->assertFalse( $this->widget()->has_widget_inner_wrapper() );
	}

	public function test_initial_config_supports_improved_repeaters(): void {
		$widget = $this->widget();

		$method = new \ReflectionMethod( $widget, 'get_initial_config' );
		$method->setAccessible( true );

		/** @var array<string, mixed> $config */
		$config = $method->invoke( $widget );

		// Without this flag core's repeater-move hook skips sortViewsByModels
		// and the editor's child-view registry drifts after drag reorders.
		$this->assertTrue( $config['support_improved_repeaters'] ?? false );
	}

	public function test_default_children_are_three_containers(): void {
		$widget = $this->widget();

		$method = new \ReflectionMethod( $widget, 'get_default_children_elements' );
		$method->setAccessible( true );

		/** @var array<int, array<string, mixed>> $children */
		$children = $method->invoke( $widget );

		$this->assertCount( 3, $children );
		foreach ( $children as $child ) {
			$this->assertSame( 'container', $child['elType'] );
		}
	}
}
