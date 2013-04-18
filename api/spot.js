	var restify = require('restify')
	,	nconf = require('nconf')
	,   validate = require('jsonschema').validate
	,   Parse = require('kaiseki')
	,   winston = require('winston')
	,   redis = require("redis")
	,   colors = require('colors')
	,   client = redis.createClient()
	,   async = require('async')
	,   Datastore = require('../services/DataStore')
	,   logger = require('winston');
	    
	redisSpotIdKey = 'spot:id:counter';
	
	var options = {
	   colorize : "true"
	};
	
	var logger = new (winston.Logger)({
		transports: [
			new winston.transports.Console({timestamp:true}),
			new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/spot_server.log') })
		],
		exceptionHandlers: [
		    new winston.transports.Console({timestamp:true}),
			new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/spot_server.log') })
		] 
	});

	logger.info('Spot restify client started'.help);

	nconf.argv()
	       .env()
	       .file({ file: require('path').resolve(__dirname, '../settings.json') });

	// just incase our config settings file goes missing again :)
	if (!nconf.get("parse:appId")) {
		console.log("Unable to locate 'Parse:AppID' in Config file (settings.json).");
		process.exit();
	}

	var redisExpireTime = parseInt(nconf.get('redis:expireTime'));
	var DEFAULT_PORT = 8085;
	var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey')); 
	var restPort = DEFAULT_PORT;

	// @todo move schema into schema file
	var spotSchema = {
	   "id": "/SimpleSpot",
		"type":"object",
		"properties" : {
			 "lat" : {"type":"number", "required": true},
			 "lon" : {"type":"number", "required": true},  
			 "spotId": {"type":"number", "required":false},       
			 "name" : {"type":"string", "required": true},
			 "description" : {"type":"string"},
			"wind_directions": {
				"type": "array",
				"items": {"type": "string"},
				"required":true
			},
			"sketchy_directions": {
				"type": "array",
				"items": {"type": "string"},
				"required":false
			},
			"keywords": {
				"type": "array",
				"items" : {"type":"string"},
				"required": false
			}
		}        
	}

	var updateSpotSchema = {
	   "id": "/UpdateSpot",
		"type":"object",
		"properties" : {
			"location" : {"required": true},
			"spotId": {"type":"number", "required":true},       
			"name" : {"type":"string", "required": true},
			"description" : {"type":"string"},
			"wind_directions": {
				"type": "array",
				"items": {"type": "string"},
				"required":true	
			},
			"keywords": {
				"type": "array",
				"items" : {"type":"string"},
				"required": false
			}
		}        
	}

	if (nconf.get('api:spot:port')) {
	   restPort = nconf.get('api:spot:port');
	}
	
	logger.debug('nconf port: ' + restPort); 
	
	process.argv.forEach(function (val, index, array) {
		if (val === '-p') {
			restPort = array[index+1] || DEFAULT_PORT;
		}
	}); 


	// Create server
	var server = restify.createServer();	
	server.listen(restPort, function() {
		console.log('%s listening at %s'.blue, server.name, server.url);
	});
	
	/**
	   SPOT API
	**/
	
	/**
	   ~~ HTTP GET 
	   @geoloc - tested
	   @lat,@lon - tested
	   @keywords [...,...] - tested
	   @description =[] - tested
	   @mode [filter,compound] - tested
	   @limit  - number of results to return - tested
	   @miles/km
	   @radians
	**/	
	server.get('spot/api', function(req, res) {
	   var api = {}
	   api.queryParams = {
	      GET : {    
	         geoloc : {"[lat,lon]" : "Lattitude,Longitude", "tested": true },
	         lat : "Lattitude (required with lon)",
	         lon : "Longitude (required with lat)",
	         keywords: {
	         	description: "search list of keywords, separated by comma",
	         	mode: "queryParam: [filter/compound] - change keyword search mode"
	         },
	         description: "search description field, partial matching",
	         limit: "number: Limit number of results",
	         miles: "number/metric: choose number of miles for search radius",
	         km: "number/metric: choose number of kilometers for search radius",
	         radians: "number/metric: choose number of radians for search radius"
	      },
	      POST: {
	         description: "Create a Spot, request is JSON content",
	         required : {
	            geoloc : "lat,long coordinates",
	            lat : "if no geoloc, latitude",
	            lon : "if no geoloc, longitude",
	            name : "Name of spot"
	         },
	         optional : {
	            "keywords": "assign keywords, separated by commas",
	            "description": "description"
	         }
	        
	      },
	      PUT: {
	         description: "Update a Spot, request is JSON content",
	         "/:id" : "Update Spot, must have required fields"
	      },

	      DELETE: {
	         "/:id" : "Delete Spot by id"
	      }

	   };
	   //res.send(updateSpotSchema);
	   res.send(api);
	});

	/**
	 * API: /Spot
	 */
	server.get('/spot', function(req, res) {

		var queryParts = require('url').parse(req.url, true).query;
		var lat, lon, distance = 30000, limit = 10, distanceFormat = null;
		//   var redisKey = "spot:search:";
		var redisKey = "";
		redisKey = addToRedisKey(redisKey, "spot", "search");
		var queryParams = {
			//limit : limit,
			count: true        
		};
		
		// If Search is by GeoLocation
		if (queryParts.geoloc) {
			logger.debug('geoloc: '.red + queryParts.geoloc);
			lat = Number(queryParts.geoloc.split(/,/)[0]);
			lon = Number(queryParts.geoloc.split(/,/)[1]);
			redisKey = addToRedisKey(redisKey, 'geoloc', queryParts.geoloc);
			logger.debug("redisKey" + redisKey.red);

		// If Search is by Lat/Long
		} else if (queryParts.lat && queryParts.lon) {
			lat = Number(queryParts.lat);
			lon = Number(queryParts.lon);
			redisKey = addToRedisKey(redisKey,  'latlon', [lat, lon]);
		}
		
		// If we Have a Limit on Our Search
		logger.debug('redisKey: ' + redisKey);
		if (queryParts.limit) {
			limit =  Number(queryParts.limit);
			queryParams.limit = limit;
			redisKey = addToRedisKey(redisKey, ["limit", limit]);
		}

		// If our Search is Done With Miles, K/M, or Radians
		if (queryParts.miles){
			distanceFormat = "$maxDistanceInMiles";
			distance =  Number(queryParts.miles);
			redisKey = addToRedisKey(redisKey, 'miles',distance);
		} else if (queryParts.km) {
			distanceFormat = "$maxDistanceInKilometers";
			distance =  Number(queryParts.km);
			redisKey = addToRedisKey(redisKey, "km", distance);      
		}  else if (queryParts.radians) {
			distanceFormat = "$maxDistanceInRadians";
			distance =  Number(queryParts.radians);
			redisKey = addToRedisKey(redisKey, "radians", distance);      
		}

		// Search for name
		if (queryParts.name) {
			queryParams.where = {
				name: queryParts.name
			}
			addToRedisKey(redisKey, "name", queryParts.name);      
		}

		// Search for description
		if (queryParts.description) {
			queryParams.where = {
				description: queryParts.description
			}
			redisKey += queryParts.description;
			addToRedisKey(redisKey, "description", queryParts.description);      
		}

		// Search by keywords
		if (queryParts.keywords) {
			var mode = 'compound';
			redisKey = addToRedisKey(redisKey, "keywords", queryParts.keywords);      
			redisKey = addToRedisKey(redisKey, "mode", mode);      
			if (queryParts.mode && (queryParts.mode === "compound" || queryParts.mode === "filter")) {
				mode = queryParts.mode;
			}
			var arr = queryParts.keywords.split(/,/);
			console.log(queryParams.red);
			if (mode === "compound") {
				var params = "{ \"$or\":[";
				arr.forEach(function(item){
					console.log('item: ' + item);
					params += "{\"keywords\":\"" + item + "\"},"
					console.log('redisKey: ' + redisKey);
				});
				// remove trailing comma
				params = params.substring(0, params.length-1);
				params += "]}"; // close out the json object
				queryParams.where = params;
			} else if (mode === "filter") {
				var params = "{";
				arr.forEach(function(item){
					console.log('item: ' + item);
					params += "\"keywords\":\"" + item + "\","
				});
				// remove trailing comma
				params = params.substring(0, params.length-1);
				params += "}"; // close out the json object
				queryParams.where = params;
			}
			console.log('params: ' + params);
			var json = JSON.parse(params);
			console.log('jsonified: ' + JSON.stringify(json));
			logger.debug('keywords params: ' + JSON.stringify(queryParams));
			
		}

		if (lat && lon) {      
			// query with parameters
			queryParams = {
				limit : limit,
				count: true,
				where : {
					location: {
						"$nearSphere" : {
								__type: 'GeoPoint',
								latitude: lat,
								longitude: lon,
								limit : limit
							}
						//,"$maxDistanceInMiles": distance
						}
				}
			}
		}
	   
		if (distanceFormat != null) {
			logger.error('here, queryParams:' + JSON.stringify(queryParams));
			if (distanceFormat.indexOf('K') != -1) {
				queryParams.where.location.$maxDistanceInKilometers = distance;
			} else if (distanceFormat.indexOf('M') != -1) {
				queryParams.where.location.$maxDistanceInMiles = distance;
			} else if (distanceFormat.indexOf('R') != -1) {
				queryParams.where.location.$maxDistanceInRadians = distance;
				logger.error('here2'); 
			}
		}
	   
		if (distance == -1) {
			delete params.maxDistanceInMiles;
		}

		// Use DataStore Instead
		Datastore.records.object("Spot", queryParams, function(err, response, body, success) {
			res.send(body);
		});

	});
	
	// Retrieve specific spotId	
	server.get('/spot/:id', function(req, res) {
		//res.send('get spot id API: ' + req.params.id);
		var id = parseInt(req.params.id);
		var queryParams = {
			where: {
				spotId: id
			}
		};
		Datastore.records.object("Spot", queryParams, function(err, response, body, success) {
			if (body.length == 0) {
				res.send(404, "Spot " + id + " not found.");
				return true;
			} else {
				res.send(body);
			}
		});
	});
	
	/*
	
	Example Spot POST:
	{
	"lat":24.0499,
	"lon":-109.9880,
	"name":"Test",
	"description": "Delete me",	
	"wind_directions": ["N", "NE", "E", "SE"]
	}
	*/
	/**
	 * POST (Edit)
	 */
	server.post('/spot', function(req, res) {
		var queryParts = require('url').parse(req.url, true).query;
		var data = "";
		req.on('data', function(chunk) {
			data += chunk;
		});
		
		req.on('end', function() {
			//console.log('dater: ' + data);
			var json, valid;
			try {
				json = JSON.parse(data);
			} catch (err) {
				console.log('Error parsing data: ' + err);
				res.send(400, err);
				return;
			} 
			valid = validate(json, spotSchema);
			if (valid.length > 0 ) {
				console.log('Error validating spot schema:\n', valid);
				res.send(500, 'Error validating spot schema:\n' + valid);
				return;
			} else if (json.lat > 90 || json.lat < -90  || json.lon < -180 || json.lon > 180){
				res.statusCode = 400;
				res.send("Invalid lat/long format");
				return;
			} else {
				createSpot(json, res);
			}
		});
	});

	/**
	 * PUT (Create)
	 */
	server.put('/spot/:id', function(req, res){
	   var queryParts = require('url').parse(req.url, true).query;
	   var data = "";
	   req.on('data', function(chunk) {
	      data += chunk;
	   });
	   
	   req.on('end', function() {
	      //console.log('dater: ' + data);
	      var json, valid;
	      try {
		      json = JSON.parse(data);
	      } catch (err) {
		      console.log('Error parsing data: ' + err);
		      res.statusCode = 400;
		      res.send(err);
		      return;
	      }
	      valid = validate(json, updateSpotSchema);
	      if (valid.length > 0 ) {
	         res.send(400, 'Error validating spot schema:' + JSON.stringify(valid));
	         return;
	      } else if (json.lat > 90 || json.lat < -90  || json.lon < -180 || json.lon > 180){
	         res.statusCode = 400;
	         res.send("Invalid lat/long format");
	         return;
	      } else {
//		      Datastore.records.save("spot", json);
	         updateSpot(json);
	      }
	      
	      //console.log('all the data received: ', JSON.stringify(json));
	      res.send('Spot for ' + json.name + ' created');
	   });
	});
	
	server.del('/spot/:id', function(req, res) {
		var id = req.params.id;
		console.log('id: ' + id);
		var queryParams = {
			where: {
				spotId : parseInt(req.params.id)   
			},
		};
		parse.getObjects('Spot', queryParams , function(err, response, body, success) {
			console.log('found object = ', body, 'success: ' , success);
			var bodyJson = JSON.parse(JSON.stringify(body));
			if (body.length == 0) {
				res.send(404, "Spot " + req.params.id + " doesn't exist");
				return;
			}
			var spot = bodyJson[0];            
			var spotParseId = spot.objectId;
			logger.info('spotParseId to delete: '.red + spotParseId );
			parse.deleteObject("Spot", spotParseId, function(err, response, body, success){
				console.log( "body: " + JSON.stringify(body) + ', success: ' + success);
				if (err) {
					res.sendError('Error deleting spot: ' + err);
				} else if (success === true) {
					res.send('Spot ' + id + ' successfully deleted');
					return;
				}
			});
		});
	});
	
	/**
	   Function to call parse, create Spot object
	**/
	function createSpot(spot,res) {
	   console.log('spot to create: ' + JSON.stringify(spot));
	    
	   spot.location = {
	       __type: 'GeoPoint',
	       latitude: spot.lat,
	       longitude: spot.lon
	    };
		// remove unnecessary lat/lon since it was converted to GeoPoint
	   delete spot.lat;
	   delete spot.lon;
	   
	   // 1. increment and get spot ID for lookup
	   // 2. Save the spot
	   var spotId; 
	   client.incr(redisSpotIdKey, function(err, replies) {
	      spotId = replies; 
	      spot.spotId = spotId;  
	      parse.createObject("Spot", spot, function(err, res2, body, success) {
	         logger.info(JSON.stringify(body));
	         res.send(body);
	      });
	   });
	  
	   
	};
	
	function addToRedisKey(redisKey, key, array) {
		//logger.debug('addToRedisKey: ' + key + ', ' + array);
		var retString = key + ':';
		if (array instanceof Array ) {
			array.forEach(function(item) {
				retString += item + ":";
			});
		} else {
			retString += array + ':'
		}
		redisKey += retString;
		//logger.debug('new redisKey: '.yellow + redisKey);
		return redisKey
	}
	
	/**
	   Function to call parse, update existing Spot object
	**/
	function updateSpot(spot) {
		if (!spot.objectId) {
			throw new Error("No ID in object");
		}
		logger.info('spot to create: ' + JSON.stringify(spot));
		// remove Parse internal readonly fields before sending
		/*
		delete spot.objectId;
		delete spot.createdAt;
		delete spot.updatedAt;
		*/
		parse.updateObject("Spot", spot.objectId, spot, function(err, res, body, success) {
			console.log('object created = ', body);
			var redisKey = 'spot:id:' + spot.spotId;
			client.del(redisKey, function(error, reply) {
				logger.debug('stale key deleted: ' + redisKey);
			});
		});
	};
	


