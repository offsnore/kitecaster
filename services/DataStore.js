var redis = require('redis')
  , nconf = require('nconf')
  , crypto = require('crypto')
  , winston = require('winston')
  , ParseObject = require('kaiseki')
  , fs = require('fs')
  , Parse = require('parse-api').Parse;

var app = module.exports.records = {};
var base = module.exports;

app.results = {}

/**
 * Modules does a check into the LocalStore, if not there, hits DataStore, if found, saves to LocalStore
 * @note Added alias 'find()' for 'getCurrent()' (falls more inline with save())
 */
app.find = app.getCurrent = function(db, key, callback) {
	var parseApp = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));
	var client = redis.createClient();
	client.on("error", function(err) {
		console.log("error event - " + client.host + ":" + client.port + " - " + err);
	});
	
	// console.log('app-find', key);
	
	var found = false;
	// generate a Hash Key for Lookups
	if (typeof key != 'string') {
		var hashkey = JSON.stringify(db) + JSON.stringify(key);
	} else {
		var hashkey = JSON.stringify(db) + key;
	}
	//var hashkey = crypto.createHash("md5").update(hashkey).digest("hex");
	client.get(hashkey, function(err, reply) {
		if (reply) {
			app.results = JSON.parse(reply);
			var found = true;
		}
		if (!found) {
			if (key == "*") {
				parseApp.find(db, '', function(err, response){
					//client.set(hashKey, JSON.stringify(app.results));
					app.results = response;
					callback(app.results);
				});
			} else {
				// try and hit the DB
				parseApp.find(db, key, function (err, response) {
					app.results = response;
					client.set(hashkey, JSON.stringify(app.results));
					callback(app.results);
				});
			}
		} else {
			client.quit();
			callback(app.results);
		}
	});
}

app.file = function(filename, callback) {
	var parseApp = new ParseObject(nconf.get('parse:appId'), nconf.get('parse:restKey'));	

	fs.exists(filename, function(exists){
		if (!exists) {
			console.log("Unable to find file: " + filename);
		} else {
			parseApp.uploadFile(filename, function(err, res, body, success) {
				callback(body.url, body.name);
			});
		}
	});

}

/**
 * App.Object()
 * @param db		string
 * @param query		mixed
 * @param callback	method
 */
app.object = function(db, query, callback) {
   var appId = nconf.get('parse:appId');
   var restKey = nconf.get('parse:restKey');
	var parseApp = new ParseObject(appId, restKey);

	// abstract logic to base()
	/**
	var client = redis.createClient();
	client.on("error", function(err) {
		console.log("error event - " + client.host + ":" + client.port + " - " + err);
	});	
	**/

	var err, response, sbody = {}, body = {}, success = {};

	try {
		base.getlocalobject(db, query, function(err, res) {
			// temp for DEV (no cache brah)
			// var res = null;
			if (res != null) {
				app.results = res;
				body = res.body;
				callback(null, res, body, success);
			} else {
				parseApp.getObjects(db, query, function(err, response, body, success) {
					if (err) {
						throw Error("An error occured: ", JSON.stringify(err));
					} else {
						app.results = response;
						base.setobject(db, query, body);
						callback(err, response, body, success);
					}
				});
			}
		});
	} catch (e) {
		console.log("An unexpected error occurred: ", JSON.stringify(e));
	}
};

/**
 * App.ObjectUpdate()
 */
app.objectupdate = function(db, objectId, query, callback) {

	try {
		var parseApp = new ParseObject(nconf.get('parse:appId'), nconf.get('parse:restKey'));

		if (!objectId) {
			throw Error("ObjectID is required to Update Object in Parse.com. Please use object()/find() before using objectupdate().");
		}

//		var client = redis.createClient();
//		client.on("error", function(err) {
//			console.log("error event - " + client.host + ":" + client.port + " - " + err);
//		});

		parseApp.updateObject(db, objectId, query, function(err, res, body, success) {			
			if (typeof body.error != 'undefined') {
				logger.debug("Parse.com responded with an error, ", JSON.stringify(body.error));
				return false;
			}

			base.setobject(db, query, body, false, function(){
				callback(err, res, body, success);
			});

			// @todo - include Redis back into here
			//var redis_key = base.createkey(db, query);
			//var redisKey = 'spot:id:' + spot.spotId;
			//client.del(redis_key, function(error, reply) {
			//	logger.debug('stale key deleted: ' + redis_key);
			//});
		});
	} catch (e) {
		console.log("An unexpected error occured: " + JSON.stringify(e));
	}
}

/**
 * app.CreateObject()
 * Handles creating (and incrementing redis) objects in Parse(.)com DataStore
 */
app.createobject = function(db, object, callback, auto_increment) {
	if (typeof auto_increment == 'undefined') {
	  // TODO: should this be defaulted to false?
		var auto_increment = true;
	}
	try {
		var parseApp = new ParseObject(nconf.get('parse:appId'), nconf.get('parse:restKey'));
		var rediskey = "counter:id:spot";

		var client = redis.createClient();
		client.on("error", function(err) {
			console.log("error event - " + client.host + ":" + client.port + " - " + err);
		});
		
		if (auto_increment) {
			client.incr(rediskey, function(err, replies) {
				object.spotId = replies;
				parseApp.createObject(db, object, function(err, res, body, success) {
					callback(err, res, body, success);
				});
			});
		} else {
			parseApp.createObject(db, object, function(err, res, body, success) {
				callback(err, res, body, success);
			});
		}
	} catch (e) {
		console.log("An unexpected error occured: " + JSON.stringify(e));
	}
};

app.deleteobject = function(db, query, callback) {
	var parseApp = new ParseObject(nconf.get('parse:appId'), nconf.get('parse:restKey'));
	try {
		this.object(db, query, function(err, response, body, success) {
			if (body.length === 0) {
				callback(err, response, body, success);
			} else {
				for (obj in body) {
					var id = body[obj].objectId;
					parseApp.deleteObject(db, id, function(err, response, body, success) {
						callback(err, response, body, success);
					});
				}
			}
		});
/**
		parseApp.getObjects(db, query, function(err, response, body, success) {
			console.log(response, body);
			console.log('found object = ', body, 'success: ' , success);
//			var bodyJson = JSON.parse(JSON.stringify(body));
//			if (body.length == 0) {
//				throw Error("Record in " + db + " doesn't exist.");
//				return;
//			}
//			var object = bodyJson[0];
//			var id = object.objectId;
//			parseApp.deleteObject(db, id, function(err, response, body, success){
//				callback(err, response, body, success);
//			});
		});
**/
	} catch (e) {
		console.log("An unexpected error occured: " + JSON.stringify(e));
	}
}

/**
 * App.Create()
 * Handles creating new objects in the Parse Store()
 * @usage app.create('Profiles', {'session_id':'session_id, 'field1':'key1'}, function(err, response){});
 */
app.create = function(db, data, callback) {
	var logger = new (winston.Logger)({
		transports: [
			new winston.transports.Console({timestamp:true})
			//new winston.transports.File({ timestamp:true, filename: '/var/logs/kitecaster/server.log' })
		],
		exceptionHandlers: [
			new winston.transports.Console({timestamp:true})
			//new winston.transports.File({ timestamp:true, filename: '/var/logs/kitecaster/server-exceptions.log' })
		]
	});

	var parseApp = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));
	var client = redis.createClient();
	client.on("error", function(err) {
		console.log("error event - " + client.host + ":" + client.port + " - " + err);
	});
	try {
		parseApp.insert(db, data, function(err, response) {
			logger.debug("insert result");
			logger.debug(err);
			logger.debug(JSON.stringify(response));
			callback(err, response);
		});
	} catch (e) {
		logger.debug(e);
		return false;		
	}
};

/**
 * App.Save()
 * Handles creating and/or updating records in the Parse Store
 * @usage app.save('profiles', {"session_id":session_id}, {"field1":"field_value"}, function(err, response){});
 * @todo Include a save to local Redis Datastore (prevent 1 more hit to remote Db)
 */
app.save = function(db, key, data, callback) {
	var logger = new (winston.Logger)({
		transports: [
			new winston.transports.Console({timestamp:true})
			//new winston.transports.File({ timestamp:true, filename: '/var/logs/kitecaster/server.log' })
		],
		exceptionHandlers: [
			new winston.transports.Console({timestamp:true})
			//new winston.transports.File({ timestamp:true, filename: '/var/logs/kitecaster/server-exceptions.log' })
		]
	});

	var parseApp = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));
	var client = redis.createClient();
	client.on("error", function(err) {
		console.log("error event - " + client.host + ":" + client.port + " - " + err);
	});
	try {
		parseApp.find(db, key, function (err, response) {
			if (response) {
				var id = response.objectId;
				parseApp.update(db, id, data, function (err, response) {
					logger.debug("update result");
					logger.debug(err);
					logger.debug(JSON.stringify(response));
					callback(err, response);
				});
			} else {
				parseApp.insert(db, data, function(err, response) {
					logger.debug("insert result");
					logger.debug(err);
					logger.debug(JSON.stringify(response));
					callback(err, response);
				});			
			}
		});
	} catch (e) {
		logger.debug(e);
		return false;
	}
	callback();
}

/**
 * Base.createkey()
 */
base.createkey = function(db, key, callback) {
	var hashkey = JSON.stringify(db) + JSON.stringify(key);
	var hashkey = crypto.createHash("md5").update(hashkey).digest("hex");
	base.namespace_key = db;
	base.getnamespace(function(replies){
        var hash = db + ":" + replies + ":" + hashkey;
        if (typeof callback == 'function') {
            callback(hash);
        }
	});
}

/**
 * Base.clearkey()
 * Does a cache removal of local object
 */
base.clearkey = function(db, key) {
	var client = redis.createClient();
	client.on("error", function(err) {
		console.log("error event - " + client.host + ":" + client.port + " - " + err);
	});
	var hashkey = base.createkey(db, key);
	// if there is no data, expire the key
	client.del(hashkey);
	return true;	
}

// some pre-defines
var DEFAULT_NAMESPACE = "all";
base.namespace_key = DEFAULT_NAMESPACE;

/**
 * base.SetNamespace
 */
base.setnamespace = function(text) {
    base.namespace_key = test;
}

/**
 * Base.GetNamespace
 */
base.getnamespace = function(callback) {
    var err;
    var client = redis.createClient();
	client.on("error", function(err) {
		console.log("error event - " + client.host + ":" + client.port + " - " + err);
	});
	var key = base.namespace_key;
	client.get(key, function(err, replies) {
        if (replies == null) {
            base.createnamespace(key, function(replies){
                console.log(replies);
                if (typeof callback == 'function') {
                   callback(replies);
                }
            });
        } else {
            if (typeof callback == 'function') {
               callback(replies);
            }
        }
    });
}

/**
 * Base.CreateNamespace
 */
base.createnamespace = function(callback) {
    console.log('first hit, create 1');
    base.incrementnamespace(base.namespace_key, function(err, replies){
        if (typeof callback == 'function') {
            callback(replies);
        }
    })
}

base.incrementnamespace = function(key, callback) {
    var err;
    var client = redis.createClient();
	client.on("error", function(err) {
		console.log("error event - " + client.host + ":" + client.port + " - " + err);
	});
	console.log(key + " is trying to increment");
	client.incr(key, function(err, replies) {
	   if (typeof callback == 'function') {
    	   callback(replies);
	   }
	   return true;
    });
}

/**
 * Base Level Method
 * Handles setting an object to Redis
 */
base.setobject = function(db, query, object, expires, callback) {
	var err;
	if (object == null) {
		callback(err, false);
	}
	var client = redis.createClient();
	client.on("error", function(err) {
		console.log("error event - " + client.host + ":" + client.port + " - " + err);
	});
	base.createkey(db, query, function(hashkey){
    	// set expiration time for Redis (default to 60 seconds)
    	var expiration_time = expires || nconf.get("redis:expireTime") || 60;
    	var diff, date_end, date_start;
    	var setobject = JSON.stringify(object);
    	client.set(hashkey, setobject, function(err, replies) {            
    		date_end = new Date().getUTCMilliseconds();
    		diff = date_end - date_start;
    		client.expire(hashkey, expiration_time, function (err, replies) {
    			//console.log('expire set for ' + key + ' to ' + expiration_time + ' seconds.');
    		});
    		if (typeof callback == 'function') {
    			callback(err, replies);
    		}
    	});
	});
}

/**
 * Base Level Method
 * Check against Redis (local cache) for object
 */
base.getlocalobject = function(db, query, callback) {
	var client = redis.createClient();
	client.on('error', function(err) {
		console.log("error event: " + JSON.stringify(err));
	});
	var hashkey = base.createkey(db, query);
	client.get(hashkey, function(err, reply) {
		var reply = JSON.parse(reply);		
		if (err) {
			console.log("error occured: "+JSON.stringify(err));
		} else {
			if (!reply) {
				// if there is no data, expire the key
				// @maybe increment namespace?
				// client.del(hashkey);
				callback(err, null);
			} else {
				var reply = {
					body: reply
				};
				callback(err, reply);
				if (!callback) {
					return reply;
				}
			}
		}
	});
}

/**
 * Base.CreateGeoPoint()
 * handles transforming data from lat/long strings into GeoPoint dataType
 * @note - move this to a better place
 */
base.creategeopoint = function(data) {
   data.location = {
       __type: 'GeoPoint',
       // we make sure we're sending numbers not strings
       latitude: parseFloat(data.lat),
       longitude: parseFloat(data.lon)
    };
	// remove unnecessary lat/lon since it was converted to GeoPoint
	if (typeof data.lat != 'undefined') delete data.lat;
	if (typeof data.lon != 'undefined') delete data.lon;
	return data;
}
