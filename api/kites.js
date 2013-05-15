var restify = require('restify')
	,	nconf = require('nconf')
	,   validate = require('jsonschema').validate
	,   Parse = require('kaiseki')
	,   winston = require('winston')
	,   redis = require("redis")
	,   colors = require('colors')
	,   client = redis.createClient()
	,   async = require('async')
	,	jsonp = require('jsonp-handler')
	,   Datastore = require('../services/DataStore')
	,   logger = require('winston');
	
	var options = {
	   colorize : "true"
	};
	
	var logger = new (winston.Logger)({
		transports: [
			new winston.transports.Console({timestamp:true}),
			new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kites_server.log') })
		],
		exceptionHandlers: [
		    new winston.transports.Console({timestamp:true}),
			new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kites_server.log') })
		] 
	});

	logger.info('Kites restify client started'.help);

	nconf.argv()
	       .env()
	       .file({ file: require('path').resolve(__dirname, '../settings.json') });

	// just incase our config settings file goes missing again :)
	if (!nconf.get("parse:appId")) {
		console.log("Unable to locate 'Parse:AppID' in Config file (settings.json).");
		process.exit();
	}

	var redisExpireTime = parseInt(nconf.get('redis:expireTime'));
	var DEFAULT_PORT = 8087;
	var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey')); 
	var restPort = DEFAULT_PORT;

	var getSchema = {
	   "id": "/SimpleKite",
		"type":"object",
		"properties" : {
			"userId" : {
				"type":"number", 
				"required": true
			},  
		}        
	}

	if (nconf.get('api:kite:port')) {
	   restPort = nconf.get('api:kite:port');
	}
	
	logger.debug('nconf port: ' + restPort); 
	
	process.argv.forEach(function (val, index, array) {
		if (val === '-p') {
			restPort = array[index+1] || DEFAULT_PORT;
		}
	}); 

	// Create server
	var server = restify.createServer();	

	// incase we get errors, lets know about them :)
	server.on("error", function(r, v) {
		console.log("error occured: " + JSON.stringify(r) + "," + JSON.stringify(v));
	});

	server.listen(restPort, function() {
		console.log('%s listening at %s'.blue, server.name, server.url);
	});
	
	// KitePage API
	server.get('/kite/api', function(req, res) {
		var api = {}
		api.queryParams = {
			GET : {
				"userID": "The userID that belongs to the KiteSpots", 
				"test": false
			},
			POST: {},
			PUT: {
				description: "Update a Spot, request is JSON content",
				"/:id" : "Update Spot, must have required fields"
			},			
			DELETE: {
				"/:id" : "Delete Spot by id"
			}
		};
		res.send(api);
	});

	// KitePage API
	// GET /kite
	server.get('/kite', function(req, res) {
		var queryParts = require('url').parse(req.url, true).query;
		if (!queryParts.userId) {
			res.send(400, "A valid UserId is required for this API.");
			return false;
		}
		
		var lat, lon;
		var queryParams = {};

		// If Search is by GeoLocation
		if (queryParts.geoloc) {
			logger.debug('geoloc: '.red + queryParts.geoloc);
			lat = Number(queryParts.geoloc.split(/,/)[0]);
			lon = Number(queryParts.geoloc.split(/,/)[1]);	
		// If Search is by Lat/Long
		} else if (queryParts.lat && queryParts.lon) {
			lat = Number(queryParts.lat);
			lon = Number(queryParts.lon);
		}

		// If our Search is Done With Miles, K/M, or Radians
		if (queryParts.miles){
			distanceFormat = "$maxDistanceInMiles";
			distance =  Number(queryParts.miles);
		} else if (queryParts.km) {
			distanceFormat = "$maxDistanceInKilometers";
			distance =  Number(queryParts.km);
		}  else if (queryParts.radians) {
			distanceFormat = "$maxDistanceInRadians";
			distance =  Number(queryParts.radians);
		}

		/**
		if (lat && lon) {
			queryParams.limit = limit;
			queryParams.count = true;
			if (queryParams.where) {
				queryParams.where = JSON.parse(queryParams.where);				
			}
			if (!queryParams.where) {
				queryParams.where = {};
			}			
			queryParams.where.location = {
					"$nearSphere" : {
						__type: 'GeoPoint',
						latitude: lat,
						longitude: lon,
						limit : limit
					}
			};
		}
		**/

		if (typeof queryParams.where != 'undefined' && typeof queryParams.where.location != 'undefined' && distanceFormat != null) {
			logger.error('here, queryParams:' + JSON.stringify(queryParams));
			if (distanceFormat.indexOf('K') != -1) {
				queryParams.where.location.$maxDistanceInKilometers = distance;
			} else if (distanceFormat.indexOf('M') != -1) {
				queryParams.where.location.$maxDistanceInMiles = distance;
			} else if (distanceFormat.indexOf('R') != -1) {
				queryParams.where.location.$maxDistanceInRadians = distance;
			}
		}

		// @todo add in params for sorting by Score & Distance, Score, Distance
		var queryParams = {
			'where': {
				'userId': queryParts.userId
			}
		};
		
		// Use DataStore Instead
		Datastore.records.object("Subscribe", queryParams, function(err, response, body, success) {
			//res.send(body);
			if (body && body.length > 0) {
				// @todo Make method within Datastore that handles OR queries
				var oro = [];
				for (var spot in body) {
					var spotId = body[spot].spotId;
					var orq = {
						"spotId": parseInt(spotId)
					};
					oro.push(orq);
				}
				var q = {
					where: {
						"$or": oro,
					}
				};

				if (lat && lon) {
					q.where.location = {
						"$nearSphere": {
							__type: 'GeoPoint',
							latitude: lat,
							longitude: lon,
							limit: 5000 // hardcoded override so that /Parse.com doesnt limit our query
						},
						"$maxDistanceInMiles": 5000 // same the override above
					};				
				}

				Datastore.records.object("Spot", q, function(err, response, body, success) {
					res.send(body);
				});
			} else {
				res.send(body);				
			}
		});
	});	


