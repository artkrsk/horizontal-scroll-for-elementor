<?php

namespace Arts\HorizontalScroll\Tests\Integration;

class WidgetRegistrationTest extends TestCase {

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

	public function test_initial_config_patches_repeater_changes_with_no_dom_targets(): void {
		$widget = $this->widget();

		$method = new \ReflectionMethod( $widget, 'get_initial_config' );
		$method->setAccessible( true );

		/** @var array<string, mixed> $config */
		$config = $method->invoke( $widget );

		// Without the flag, core re-renders the whole widget on every panel
		// add/remove. With it, core's remove walks target_container, which must
		// stay empty: the nested-elements hooks own the child containers.
		$this->assertTrue( $config['support_improved_repeaters'] ?? false );
		$this->assertSame( array(), $config['target_container'] ?? null );
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
