<?php

namespace Arts\HorizontalScroll\Tests\Integration;

class SmokeTest extends TestCase {

	public function test_plugin_class_loads_from_built_artifact(): void {
		$file = ( new \ReflectionClass( \Arts\HorizontalScroll\Plugin::class ) )->getFileName();

		$this->assertIsString( $file );
		$this->assertStringContainsString( '/wp-content/plugins/horizontal-scroll-for-elementor/', $file );
	}

	public function test_elementor_is_active(): void {
		$this->assertGreaterThan( 0, did_action( 'elementor/loaded' ) );
	}
}
