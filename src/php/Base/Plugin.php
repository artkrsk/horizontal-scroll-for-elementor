<?php

namespace Arts\HorizontalScroll\Base;

use ArtsHorizontalScroll\Arts\Base\Plugins\BasePlugin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * @extends BasePlugin<ManagersContainer>
 */
abstract class Plugin extends BasePlugin {

	/** @var ManagersContainer */
	protected $managers;
}
