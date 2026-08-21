<?php

namespace Arts\HorizontalScroll\Tests\Integration;

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
		$rendered = false !== strpos( $this->render_widget( 'ahsAdv', $this->panels( 1 ) ), 'elementor-widget-container' );

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
		$this->with_feature_default_state(
			self::FEATURE,
			Experiments_Manager::STATE_INACTIVE,
			function (): void {
				$this->assert_markup_and_selectors_agree();
			}
		);
	}

	public function test_markup_and_selectors_agree_with_the_experiment_on(): void {
		$this->with_feature_default_state(
			self::FEATURE,
			Experiments_Manager::STATE_ACTIVE,
			function (): void {
				$this->assert_markup_and_selectors_agree();
			}
		);
	}
}
