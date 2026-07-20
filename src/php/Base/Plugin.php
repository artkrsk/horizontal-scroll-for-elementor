<?php

namespace Arts\HorizontalScroll\Base;

use ArtsHorizontalScroll\Arts\Base\Plugins\BasePlugin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

abstract class Plugin extends BasePlugin {

	/** @var ManagersContainer */
	protected $managers;
}
