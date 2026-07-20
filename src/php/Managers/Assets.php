<?php

namespace Arts\HorizontalScroll\Managers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Arts\HorizontalScroll\Base\Manager as BaseManager;

class Assets extends BaseManager {

	const HANDLE          = 'arts-horizontal-scroll';
	const HANDLE_EDITOR   = 'arts-horizontal-scroll-editor';
	const HANDLE_POLYFILL = 'scroll-timeline-polyfill';

	/**
	 * Register (not enqueue) the frontend assets. Loading is conditional:
	 * the widget declares them via get_style_depends()/get_script_depends(),
	 * so Elementor pulls them only on pages actually using the widget.
	 */
	public function register_frontend(): void {
		wp_register_style(
			self::HANDLE,
			$this->asset_url( 'horizontal-scroll-for-elementor.css' ),
			array(),
			$this->asset_version( 'horizontal-scroll-for-elementor.css' )
		);

		// The polyfill handle is a hard dependency, not an optimization: it
		// both orders the loader ahead of us and publishes the readiness
		// promise the engine waits on before building the scrub.
		wp_register_script(
			self::HANDLE,
			$this->asset_url( 'horizontal-scroll-for-elementor.js' ),
			array( self::HANDLE_POLYFILL ),
			$this->asset_version( 'horizontal-scroll-for-elementor.js' ),
			true
		);
	}

	/**
	 * Keep the polyfill's CSS layer away from our stylesheet.
	 *
	 * That layer refetches and re-serializes whole sheets through a naive
	 * parser to rewrite scroll-timeline properties. We need none of it: the
	 * track's animation is built directly against the polyfill's WAAPI
	 * surface, whose range mapping is exact where the CSS layer's is not (it
	 * mis-maps `contain` ranges on subjects taller than the scrollport).
	 * Opting out drops the refetch and removes any
	 * chance of a second, CSS-derived animation fighting ours.
	 *
	 * @param array<int, string> $handles Style handles to skip.
	 * @return array<int, string>
	 */
	public function skip_polyfill_transpiling( $handles ): array {
		if ( ! is_array( $handles ) ) {
			$handles = array();
		}

		$handles[] = self::HANDLE;

		return $handles;
	}

	public function enqueue_editor_js(): void {
		wp_enqueue_script(
			self::HANDLE_EDITOR,
			$this->asset_url( 'horizontal-scroll-for-elementor-editor.js' ),
			array( 'nested-elements' ),
			$this->asset_version( 'horizontal-scroll-for-elementor-editor.js' ),
			true
		);
	}

	private function asset_url( string $file ): string {
		return untrailingslashit( $this->plugin_dir_url ) . '/libraries/horizontal-scroll-for-elementor/' . $file;
	}

	/** filemtime suffix busts browser/proxy caches on every bundle change (dev syncs + plugin updates alike). */
	private function asset_version( string $file ): string {
		$mtime = filemtime( $this->plugin_dir_path . 'libraries/horizontal-scroll-for-elementor/' . $file );

		return ARTS_HORIZONTAL_SCROLL_PLUGIN_VERSION . '.' . ( false !== $mtime ? (string) $mtime : '0' );
	}
}
