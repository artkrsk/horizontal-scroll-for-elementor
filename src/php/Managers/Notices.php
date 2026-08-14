<?php

namespace Arts\HorizontalScroll\Managers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Arts\HorizontalScroll\Base\Manager as BaseManager;

class Notices extends BaseManager {

	const ACTIVATE_ACTION = 'arts_hs_activate_container';

	/**
	 * The widget needs Elementor's Nested Elements experiment. It ships
	 * default-on and is an ordinary togglable feature, but it declares a
	 * dependency on "Flexbox Container": while Container is off, Elementor
	 * re-derives Nested Elements as inactive on every load, whatever that
	 * feature's own saved option holds. So the notice offers to switch on
	 * both, in that order.
	 */
	public function maybe_render_activation_notice(): void {
		if ( ! current_user_can( 'manage_options' ) || ! did_action( 'elementor/loaded' ) ) {
			return;
		}
		if ( \Elementor\Plugin::$instance->experiments->is_feature_active( 'nested-elements' ) ) {
			return;
		}

		$url = wp_nonce_url(
			admin_url( 'admin-post.php?action=' . self::ACTIVATE_ACTION ),
			self::ACTIVATE_ACTION
		);
		?>
		<div class="notice notice-warning">
			<p>
				<?php
				echo wp_kses(
					__( '<strong>Arts Horizontal Scroll</strong> needs Elementor&#8217;s Nested Elements feature, which is switched off on this site. The Horizontal Scroll widget stays hidden until it&#8217;s on.', 'horizontal-scroll-for-elementor' ),
					array( 'strong' => array() )
				);
				?>
			</p>
			<p>
				<a href="<?php echo esc_url( $url ); ?>" class="button button-primary">
					<?php esc_html_e( 'Activate Nested Elements', 'horizontal-scroll-for-elementor' ); ?>
				</a>
			</p>
		</div>
		<?php
	}

	public function handle_activation(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You are not allowed to change Elementor features.', 'horizontal-scroll-for-elementor' ), '', 403 );
		}
		check_admin_referer( self::ACTIVATE_ACTION );

		$this->activate_nested_elements();

		wp_safe_redirect( wp_get_referer() ? wp_get_referer() : admin_url() );
		exit;
	}

	/**
	 * Plain option writes are Elementor's own sanctioned mechanism (its
	 * Settings page, import/export, and V4 opt-in all reduce to them); the
	 * update_option hooks it registers for mutable features fire the cache
	 * clear and state-change actions — and only under is_admin(), which is
	 * why this runs on admin-post and never over REST.
	 */
	public function activate_nested_elements(): void {
		if ( ! did_action( 'elementor/loaded' ) ) {
			return;
		}
		$experiments = \Elementor\Plugin::$instance->experiments;

		// Container first — it has no dependencies of its own, and while it is
		// off Elementor forces nested-elements inactive on every load no matter
		// what that feature's own option holds.
		update_option( $experiments->get_feature_option_key( 'container' ), 'active' );

		// nested-elements is an ordinary mutable feature an admin can switch off
		// on its own, so Container alone is not enough. Order is load-bearing:
		// written before Container, Elementor's own dependency validation throws
		// and wp_die()s the request.
		update_option( $experiments->get_feature_option_key( 'nested-elements' ), 'active' );
	}
}
