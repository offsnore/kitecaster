	var restify = require('restify')
	,	nconf = require('nconf')
	,   util = require('util')
	,   validate = require('jsonschema').validate
	,   Parse = require('kaiseki')
	,   winston = require('winston')
	,   redis = require("redis")
	,   colors = require('colors')
	,   client = redis.createClient()
	,   async = require('async')
	,	jsonp = require('jsonp-handler')
//	,	jsonp = require('jsonp-handler')
	,   formidable = require('formidable')
	,   Weather = require('../services/KiteScoreService')
	,   Datastore = require('../services/DataStore')
	,   Datasession = require('../services/DataSession')
	,   logger = require('winston');
	    
	redisSpotIdKey = 'counter:spot:id';
	
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
	
	if (nconf.get('api:user:port')) {
	   restPort = nconf.get('api:user:port');
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

	server.on('uncaughtException', function(err) {
		console.error("Uncaught error occured: " + JSON.stringify(err));
	});

	server.listen(restPort, function() {
		console.log('%s listening at %s'.blue, server.name, server.url);
	});

	server.get('user/api', function(req, res) {
		var api = {};
		// @todo
		api.queryParams = {
			PUT: {
				lat: "number for an updated latitude",
				lon: "number for an updated longitude",
				address: "string for an updated address value"
			}
		}
		res.send(api);
	});

	var locationSchema = {
		"id": "/LocationSchema",
		"type": "object",
		"properties": {
			"userObjectId": {
				"type": "string",
				"required" : true
			},
			"lat": {
				"type": "number",
				"required" : true
			},
			"lon": {
				"type": "number",
				"required" : true
			},
			"street": {
				"type": "string",
				"required" : true
			}
		}
	};

	var locationGetSchema = {
		"id": "/LocationGetSchema",
		"type": "object",
		"properties": {
			"userObjectId": {
				"type": "string",
				"required" : true
			},
		}
	};

	var updateProfileSchema = {
		"id": "/UpdateProfileSchema",
		"type": "object",
		"properties": {
			"name": {
				"type": "string",
				"required" : true
			},
			"email": {
				"type": "string",
				"required" : true
			},
			"gender" : {
				"type" : "string"
			},
			"lastname" : {
				"type" : "string",
				"required" : true
			},
			"weight" : {
				"type" : "string"
			},
			"travel_distance" : {
				"type" : "string"
			}
		}
	};
	
	server.get('user/location', function(req, res) {
		var id = req.params.userId;
		var data = "";
		var data = require('url').parse(req.url, true).query;
		var json, valid;
		json = data;
		valid = validate(json, locationGetSchema);
		if (valid.length > 0 ) {
			res.send(400, 'Error validating spot schema:' + JSON.stringify(valid));
			return;
		} else {
			var queryParams = {
					where: json,
					order: '-createdAt',
					limit: 1
				};
			Datastore.records.object("Location", queryParams, function(err, response, body, success) {
				if (body.length == 0) {
					obj = {};
				} else {
					obj = body;
				}
				res.send(obj);
			});
		}
	});
	
	// yes, we know this is using PUT (when it should be POST)
	server.put('user/location', function(req, res) {
		var id = req.params.id;
		var data = "";
		req.on('data', function(chunk) {
			data += chunk;
		});
		req.on('end', function(){
			var json, valid;
			var json = JSON.parse(data);
			valid = validate(json, locationSchema);		
			if (valid.length > 0 ) {
				res.statusCode = 400;
				res.send('Error validating spot schema:' + JSON.stringify(valid));
				return;
			} else {
				Datasession.getuserbyauth(json.userObjectId, function(err, response, body){
					if (body.length > 0) {
						var userObjectId = body[0].UserPointer.objectId;
						json['UserPointer'] = {
							'__type' : 'Pointer',
							'className' : '_User',
							'objectId' : userObjectId
						};
						Datastore.records.createobject("Location", json, function(err, response, body){
							res.send("Location updated.");
						}, false);
					} else {
						res.send("Location update failed.");
					}
				});
			}
		});
	});
	
	// @Todo - Make this use the session cookie (b/c its needed to be secure)
	server.put('user/profile/:id', function(req, res) {
		var queryParts = require('url').parse(req.url, true).query;
		var id = req.params.id;
		var data = "";
		req.on('data', function(chunk) {
			data += chunk;
		});
		req.on('end', function() {
			var json, valid;
			try {
				// @todo pick this up instead of being passed in
				//var session = Datasession.getsession(req);
				//console.log(session);
				json = JSON.parse(data);
			} catch (err) {
				console.log('Error parsing data: ' + err);
				res.send(400, err);
				return;
			} 
			valid = validate(json, updateProfileSchema);
			if (valid.length > 0) {
				console.log('Error validating profile schema:\n', JSON.stringify(valid));
				res.send(500, 'Error validating profile schema:\n' + JSON.stringify(valid));
				return;
			} else {
				var user = Datasession.getuserbyauth(id, function(err, response, body){
					if (body) {
						var objectId = body[0].objectId;
						Datastore.records.objectupdate("Profiles", objectId, json, function(err, response, body, success){
							res.set("Content-Type", "application/json");
							res.end(JSON.stringify({"status":"Your profile has been updated."}));
							return;
						});
					}
				});
			}
		});
	});

	// breaking convention b/c browsers SUCK
	server.post('user/media', function(req, res){

    	var queryParts = require('url').parse(req.url, true).query;

    	if (!queryParts.session_id) {
        	res.writeHead(400, {'content-type':'text/plain'});
        	res.end('error:\n\nNo session provided.');
        	return true;
    	}

    	var user_object_id = queryParts.session_id;
    	var upload_dir = require('path').resolve(__dirname, '../public/media');

		var form = new formidable.IncomingForm({ uploadDir: require('path').resolve(__dirname, '../public/media'), keepExtensions: true }), files = [], fields = [];

		form.on('field', function(field, value){
			fields.push([field, value]);
		});
		
		form.on('file', function(field, file) {
			files.push([field, file]);
		});
		
		form.on('progress', function(bytes, expected) {});

		form.on('error', function(err) {
    		res.writeHead(200, {'content-type': 'text/plain'});
    		res.end('error:\n\n'+util.inspect(err));
		});

		form.on('end', function(){
			for (var x in files) {
				var file_object = files[x];
				for (var y in file_object) {
					var file = file_object[y];
					if (typeof file.name == 'undefined') {
						continue;
					}
					var file_path = file.path;

					var original_name = file.name;
					var small_name = file.name.replace(".", ".small.");
					
                    var im = require('imagemagick');
                    im.resize({
                        srcPath: file.path,
                        dstPath: upload_dir + "/" + small_name,
                        width:   250,
                        filter: 'Lagrange',
                        strip: true,
                        format: 'jpg'
                    }, function(err, stdout, stderr){
                        if (err) throw err
    
                        file_path = upload_dir + "/" + small_name;
    
    
    					Datastore.records.file(file_path, function(url, name, object){
    						if (url) {
    							var body_url= url;
    							photo_name = name;
    						}
    
                            var obj = {
                                'profile_image': body_url,
                                profile_photo: {
                                    name: photo_name,
                                    __type: "File"
                                }
                            };
    						
    						Datastore.records.objectupdate('Profiles', user_object_id, obj, function(err, response){
        						if (err) {
            						res.writeHead(409, { 'Content-Type': 'application/json' });
            						res.end(JSON.stringify({'error': err}));
        						} else {
            			            res.writeHead(200, { 'Content-Type': 'application/json' });
            			            res.end(JSON.stringify({
            				            success: true,
            				            url: body_url
            			            }));        						
        						}
    						});
    					});
                    });
					
					// @todo - Make this unique ID be used instead of the FileName and save the file details to the 'Parse.com' DB
					//var file_new_path = require('path').resolve(__dirname, '../public/media') + '/' + file.name;
					//fs.createReadStream(file_path).pipe(fs.createWriteStream(file_new_path));
				}
			}
		});

		form.parse(req, function(err, fields, files){});

        req.on('end', function() {
            console.log('All Done!!!!');
        });
		
	});

	