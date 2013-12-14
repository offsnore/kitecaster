define(['angular', 'app'], function(angular, app) {
	'use strict';

	return app.config(['$routeProvider', function($routeProvider) {

		$routeProvider.when('/home', {
			templateUrl: 'app/partials/home.html',
			controller: 'HomeCtrl'
		});

		$routeProvider.when('/spots', {
			templateUrl: 'app/partials/spots.html',
			controller: 'SpotCtrl'
		});

		$routeProvider.when('/profile', {
			templateUrl: 'app/partials/profile.html',
			controller: 'SpotCtrl'
		});

		$routeProvider.otherwise({redirectTo: '/home'});

	}]);

});