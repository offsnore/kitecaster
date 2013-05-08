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
//	,	jsonp = require('jsonp-handler')
	,   Weather = require('../services/KiteScoreService')
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
			"lat" : {
				"type":"number", 
				"required": true
			},
			"lon" : {
				"type":"number", 
				"required": true
			},  
			"spotId": {
				"type":"number", 
				"required":false
			},       
			"name" : {
				"type":"string", 
				"required": true
			},
			"description" : {
				"type":"string"
			},
			"wind_directions": {
				"type": "array",
				"items": {
					"type": "string"
				},
				"required":true
			},
			"sketchy_directions": {
				"type": "array",
				"items": {
					"type": "string"
				},
				"required":false
			},
			"keywords": {
				"type": "array",
				"items" : {
					"type":"string"
				},
				"required": false
			}
		}        
	}
	
	var subscribeSchema = {
		"id": "/SubscribeSpot",
		"type": "object",
		"properties": {
			"userId": {
				"type": "string",
				"required" : true
			}
		}
	}

	var checkinSchema = {
		"id": "/CheckinSpot",
		"type": "object",
		"properties": {
			"userId": {
				"type": "string",
				"required" : true
			}
		}
	}

	var updateSpotSchema = {
	   "id": "/UpdateSpot",
		"type":"object",
		"properties" : {
			"location" : {
				"required": true
			},
			"spotId": {
				"type":"number", 
				"required":true
			},       
			"name" : {
				"type":"string", 
				"required": true
			},
			"description" : {
				"type":"string"
			},
			"wind_directions": {
				"type": "array",
				"items": {
					"type": "string"
				},
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

	// incase we get errors, lets know about them :)
	server.on("error", function(r, v) {
		console.log("error occured: " + JSON.stringify(r) + "," + JSON.stringify(v));
	});

	server.on('uncaughtException', function(req, res, location, err) {
		console.log("Uncaught error exception: " + err);
	});

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
			//console.log(queryParams.red);
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
			jsonp.send(req, res, body);
		});

	});

	/**
	 * GET (Create)
	 * Used to grab all the spot IDs for a particular UserID
	 */
	server.get('/checkin/weather/:id', function(req, res){
		var id = req.params.id;
		var data = "";
		var data = require('url').parse(req.url, true).query;
		var queryParams = {
			where: {
				spotId: parseInt(id)
			}
		};
		Datastore.records.object("Spot", queryParams, function(err, response, body, success) {
			if (body.length == 0) {
				obj = {"error":"Spot" + id + "not found."};
				res.send(obj);
				res.end(400);
			} else {
				obj = body;
				var google_api_key = nconf.get("api:google:api_key");
				var google_image_url = "http://maps.googleapis.com/maps/api/streetview?size=300x300&location=" + obj[0].location.latitude + "," + obj[0].location.longitude + "&sensor=false&key=" + google_api_key;
				Weather.current_weather(obj[0].location.latitude, obj[0].location.longitude, function(err, obj){
					if (err) {
						res.send(JSON.stringify(err));
					} else {
						obj.google_image_url = google_image_url; 
						res.send(obj);
					}
				});
			}
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
		var queryParts = require('url').parse(req.url, true).query;
		Datastore.records.object("Spot", queryParams, function(err, response, body, success) {
			if (body.length == 0) {
				obj = {"error":"Spot" + id + "not found."};
			} else {
				obj = body;
			}
		
			// gets Spots within certain distance of THIS spot (for mapping)		
			if (queryParts.discover == 'true') {
				var distance = 10;
				var unittype = "miles";

				var limit = 5;

				var queryParams = {
					'limit': limit,
					'where': {}
				};
				
				if (queryParts.unittype) {
					var unittype = queryParts.unittype;
				}
				
				if (queryParts.distance) {
					var distance = queryParts.distance;
				}
				
				if (obj.length > 0) {
					var lat = obj[0].location.latitude;
					var lon = obj[0].location.longitude;
				}

				queryParams.where.location = {
					"$nearSphere" : {
						__type: 'GeoPoint',
						latitude: lat,
						longitude: lon
					}
				};

				Datastore.records.object("Spot", queryParams, function(err, response, body, success) {
					if (body.length == 0) {
						obj = {};
					} else {
						obj = body;
					}
					jsonp.send(req, res, obj);
				});
				
			} else {
				jsonp.send(req, res, obj);
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
	 * @note - we use the :id to handle the modifications to the spot
	 */
	server.post('/spot/:id', function(req, res) {
		var queryParts = require('url').parse(req.url, true).query;
		var data = "";
		req.on('data', function(chunk) {
			data += chunk;
		});
		
		req.on('end', function() {
			var json, valid;
			
			try {
				json = JSON.parse(data);
			} catch (err) {
				console.log('Error parsing data: ' + err);
				res.send(400, err);
				return;
			} 
			valid = validate(json, updateSpotSchema);
			if (valid.length > 0 ) {
				console.log('Error validating spot schema:\n', valid);
				res.send(500, 'Error validating spot schema:\n' + valid);
				return;
			} else if (json.lat > 90 || json.lat < -90  || json.lon < -180 || json.lon > 180){
				res.statusCode = 400;
				res.send("Invalid lat/long format");
				return;
			} else {
				try {
					var json = Datastore.creategeopoint(json);
					Datastore.records.find("Spot", {'spotId':json.spotId}, function(response){
						if (!response.results.length > 0) {
							res.send("Invalid spotID, not able to be found.");
							return;
						}
						var spotObjectId = response.results[0].objectId;
						Datastore.records.objectupdate("Spot", spotObjectId, json, function(err, response){
							var obj = {"status":"successful"};
							res.send(200, 'Spot for ' + json.name + ' was been updated!');
//							jsonp.send(req, res, obj);
						});
					});
				} catch (e) {
					console.log("An unexpected error occured: ", JSON.stringify(e));
				}
			
//				Datastore.records.objectupdate("Spot", json, function(err, res){
//					res.end("Successful update.");
//				});
//				updateSpot(json);
//				createSpot(json, res);
			}
		});
	});

	// breaking convention b/c browsers SUCK
	server.post('/media', function(req, res){
	
		console.log("uploading image..");
        var fName = req.header('x-file-name');
        var fSize = req.header('x-file-size');
        var fType = req.header('x-file-type');

//        var ws = fs.createWriteStream('./'+fName)
        req.on('data', function(data) {
            console.log(data);
  //          ws.write(data);
        });
        req.on('end', function() {
            console.log('All Done!!!!');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
	            success: true
            }));
        });
		
//		res.send("Error.");
	});

	/**
	 * PUT (Create)
	 * @note - we only "create" PUT into the server itself, because we don't know it's spotID (that's generated for us)
	 */
	server.put('/spot', function(req, res){
		var queryParts = require('url').parse(req.url, true).query;
		var data = "";
		req.on('data', function(chunk) {
			data += chunk;
		});

		req.on('end', function() {
			var json, valid;
			try {
				json = JSON.parse(data);
			} catch (err) {
				console.log('Error parsing data: ' + err);
				res.statusCode = 400;
				res.send(err);
				return;
			}
			valid = validate(json, spotSchema);
			if (valid.length > 0 ) {
				res.send(400, 'Error validating spot schema:' + JSON.stringify(valid));
				return;
			} else if (json.lat > 90 || json.lat < -90  || json.lon < -180 || json.lon > 180){
				res.statusCode = 400;
				res.send("Invalid lat/long format");
				return;
			} else {
				try {
					var json = Datastore.creategeopoint(json);
					Datastore.records.createobject("Spot", json, function(err, response){
						res.send(200, 'Spot for ' + json.name + ' was been created!');
					}, true);
				} catch (e) {
					console.log("An unexpected error occured in the SpotAPI: " + JSON.stringify(e));
				}
	      }
	      
	      //console.log('all the data received: ', JSON.stringify(json));
//	      res.send('Spot for ' + json.name + ' created!');
	   });
	});
	
	server.del('/spot/:id', function(req, res) {
		var id = req.params.id;
		var queryParams = {
			where: {
				spotId : parseInt(req.params.id)   
			},
		};

		// @todo - move this into DataStore (Del functionality)
		// @todo - check ownership of Spot before Delete
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
//				console.log( "body: " + JSON.stringify(body) + ', success: ' + success);
				if (err) {
					res.sendError('Error deleting spot: ' + err);
				} else if (success === true) {
					res.send('Spot ' + spot.name + ' has been successfully deleted');
					return;
				}
			});
		});
	});
	
	/**
	 * GET (Create)
	 * Used to grab all the spot IDs for a particular UserID
	 */
	server.get('/subscribe/spot', function(req, res){
		var id = req.params.userId;
		var data = "";

		var data = require('url').parse(req.url, true).query;

		var json, valid;
		try {
			json = data;
			valid = validate(json, subscribeSchema);
			if (valid.length > 0 ) {
				res.send(400, 'Error validating spot schema:' + JSON.stringify(valid));
				return;
			} else {
				try {
					var queryParams = {
							where: json
						};
					// the -include will link up objects in the DB and return object field values
					queryParams['include'] = "spotPointer";
					Datastore.records.object("Subscribe", queryParams, function(err, response, body, success) {
						if (body.length == 0) {
							obj = {};
						} else {
							obj = body;
						}
						jsonp.send(req, res, obj);
					});
				} catch (e) {
					console.log("An unexpected error occured in the SpotSubscribeAPI: " + JSON.stringify(e));
				}
			}
		} catch (e) {
			console.log("Unexpected error occured: " + JSON.stringify(e));
			res.statusCode = 400;
			res.send(e);
		}
	});
	
	/**
	 * PUT (Create)
	 * @note - we only "create" PUT into the server itself, because we don't know it's spotID (that's generated for us)
	 */
	server.put('/subscribe/spot/:id', function(req, res){
		var id = req.params.id;
		var data = "";
		req.on('data', function(chunk) {
			data += chunk;
		});
		req.on('end', function(){
			var json, valid;
			try {
				json = JSON.parse(data);
				valid = validate(json, subscribeSchema);
				if (valid.length > 0 ) {
					res.statusCode = 400;
					res.send('Error validating spot schema:' + JSON.stringify(valid));
					return;
				} else {
					try {
						json.spotId = id.toString();
						Datastore.records.createobject("Subscribe", json, function(err, response, body){
							if (body.error) {
								res.send(400, body.error);
							} else {
								// @todo build better error handling from Parse-com return
								res.send(200, 'Spot has been subscribed!');
							}
						}, false);
					} catch (e) {
						console.log("An unexpected error occured in the SpotAPI: " + JSON.stringify(e));
					}					
				}
			} catch (e) {
				console.log("Unexpected error occured: " + JSON.stringify(e));
				res.statusCode = 400;
				res.send(e);				
			}
		});
	});


	/**
	 * DELETE (Delete)
	 */
	server.del('/subscribe/spot/:id', function(req, res){
		var id = req.params.id;
		var queryParams = {
			"spotId": parseInt(req.params.id),
			"userId": false
		}
		// @note - there is a bug in here somehwere
		// @note - thinking it's with HEaders being sent before sTream
		var data = "";
		req.on('data', function(chunk) {
			data += chunk;
		});
		req.on('end', function(){
			json = JSON.parse(data);
			valid = validate(json, subscribeSchema);
			if (valid.length > 0 ) {
				res.statusCode = 400;
				res.send('Error validating spot schema:' + JSON.stringify(valid));
				return;
			} else {
				json.spotId = req.params.id;
				var query = {
					'where': json
				};
				try {
					Datastore.records.deleteobject('Subscribe', query, function(err, response, body){
						if (body.length == 0) {
							res.statusCode = 400;
							res.send("Spot has no subscription to delete.");
							res.end(400);
						} else {
							// removal the cache for the front page too
							Datastore.clearkey("Spot", "");
							res.statusCode = 200;
							res.send("Spot subscribe has been deleted!");
							res.end(200);
						}
					});
				} catch (e) {
					console.log("Unexepected error occured: " + JSON.stringify(e));
					res.statusCode = 400;
					res.send(JSON.stingify(e));
				}
			}
		});
	});


	/**
	 * PUT (Create)
	 * @note - we only "create" PUT into the server itself, because we don't know it's spotID (that's generated for us)
	 * @todo - create a UserID pointer so we can include details about the person
	 */
	server.put('/checkin/spot/:id', function(req, res){
		var id = req.params.id;
		var data = "";
		req.on('data', function(chunk) {
			data += chunk;
		});
		req.on('end', function(){
			var json, valid;
			try {
				json = JSON.parse(data);
				valid = validate(json, checkinSchema);		
				if (valid.length > 0 ) {
					res.statusCode = 400;
					res.send('Error validating spot schema:' + JSON.stringify(valid));
					return;
				} else {
					var query = {
						where: {
							spotId: parseInt(id)
						}
					};
					console.log(query);
					Datastore.records.object("Spot", query, function(err, response, body){
						if (body.length == 0) {
							res.end("Umm your spot id wasnt found. weird.");
							return;
						} else {
							var objectId = body[0].objectId;
							json.spotPointer = {"__type":"Pointer","className":"Spot","objectId": objectId};
							json.spotId = parseInt(id);
							var query = {
								where: {
									objectId: json.userId
								}
							};
							Datastore.records.object("Profiles", query, function(err, response, body){
								if (body.length == 0) {
									res.statusCode = 400;
									res.end("umm couldnt find your profile .. weird.");
									return false;
								} else {

									var objectId = body[0].objectId;
									json.profilePointer = {"__type":"Pointer","className":"Profiles","objectId": objectId};
								
									Datastore.records.createobject("Checkin", json, function(err, response, body){
										if (body.error) {
											res.statusCode = 400;
											res.end(body.error);
											return false;
										} else {
											// @todo, check check it complete, check for others in the same area
											res.send(200, 'You\'ve been checked into this Spot.');
										}
									}, false);
								}
							});
						}
					});
				}
			} catch (e) {
				console.log("Unexpected error occured: " + JSON.stringify(e));
				res.statusCode = 400;
			}
		});
	});



	/**
	 * GET (Create)
	 * Used to grab all the spot IDs for a particular UserID
	 */
	server.get('/checkin/spot/:id', function(req, res){
		var id = req.params.id;
		var data = "";
		var data = require('url').parse(req.url, true).query;

		var json, valid;
		try {
			json = data;
			valid = validate(json, checkinSchema);
			if (valid.length > 0 ) {
				res.send(400, 'Error validating spot schema:' + JSON.stringify(valid));
				return;
			} else {
				try {
					var queryParams = json;
					queryParams['where'] = {
						spotId: parseInt(id)
					};
					// the -include will link up objects in the DB and return object field values
					queryParams['include'] = "spotPointer";
					queryParams['include'] = "profilePointer";
					queryParams['order'] = "-createdAt";					
					Datastore.records.object("Checkin", queryParams, function(err, response, body, success) {
						if (body.length == 0) {
							obj = {};
						} else {
							obj = body;
						}
						jsonp.send(req, res, obj);
					});
				} catch (e) {
					console.log("An unexpected error occured in the SpotCheckinAPI: " + JSON.stringify(e));
				}
			}
		} catch (e) {
			console.log("Unexpected error occured: " + JSON.stringify(e));
			res.statusCode = 400;
			res.send(e);
		}
	});

	/**
	   Function to call parse, create Spot object
	**/
	function createSpot(spot,res) {
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