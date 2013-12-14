define([
	'angular',
	'filters',
	'services',
	'directives',
	'controllers',
	'angularRoute',
	], function (angular, filters, services, directives, controllers) {
		'use strict';

		// Declare app level module which depends on filters, and services
		
		return angular.module('KiteCaster', [
			'ngRoute',
			'KiteCaster.controllers',
			'KiteCaster.filters',
			'KiteCaster.services',
			'KiteCaster.directives'
		]);
});
