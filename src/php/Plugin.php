<?php

namespace Arts\HorizontalScroll;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Plugin extends Base\Plugin {

	/** @return array<string, mixed> */
	protected function get_default_config(): array {
		return array();
	}

	/** @return array<string, mixed> */
	protected function get_default_strings(): array {
		return array();
	}

	protected function get_default_run_action(): string {
		return 'plugins_loaded';
	}

	protected function get_run_action_priority(): int {
		return 20;
	}

	/** @return array<string, class-string> */
	protected function get_managers_classes(): array {
		return array(
			'assets'    => Managers\Assets::class,
			'elementor' => Managers\Elementor::class,
			'notices'   => Managers\Notices::class,
		);
	}

	protected function add_actions(): void {
		add_action( 'wp_enqueue_scripts', array( $this->managers->assets, 'register_frontend' ), 1 );
		add_action( 'elementor/widgets/register', array( $this->managers->elementor, 'register_widgets' ) );
		add_action( 'elementor/editor/before_enqueue_scripts', array( $this->managers->assets, 'enqueue_editor_js' ) );
		add_action( 'admin_notices', array( $this->managers->notices, 'maybe_render_activation_notice' ) );
		add_action(
			'admin_post_' . Managers\Notices::ACTIVATE_ACTION,
			array( $this->managers->notices, 'handle_activation' )
		);
	}

	protected function add_filters(): void {
		add_filter(
			'arts/scroll_timeline_polyfill/skipped_styles',
			array( $this->managers->assets, 'skip_polyfill_transpiling' )
		);
	}
}
