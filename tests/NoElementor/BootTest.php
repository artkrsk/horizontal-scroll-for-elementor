<?php

namespace Arts\HorizontalScroll\Tests\NoElementor;

class BootTest extends \WP_UnitTestCase {

	public function test_boots_inert_without_elementor(): void {
		$this->assertSame( 0, did_action( 'elementor/loaded' ) );
		$this->assertTrue( class_exists( \Arts\HorizontalScroll\Plugin::class ) );
	}

	public function test_plugin_file_is_the_built_artifact(): void {
		$file = ( new \ReflectionClass( \Arts\HorizontalScroll\Plugin::class ) )->getFileName();

		$this->assertIsString( $file );
		$this->assertStringContainsString( '/wp-content/plugins/horizontal-scroll-for-elementor/', $file );
	}
}
