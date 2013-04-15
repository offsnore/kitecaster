var redis = require('redis')
  , nconf = require('nconf')
  , crypto = require('crypto')
  , winston = require('winston')
  , Parse = require('parse-api').Parse;

var app = module.exports.records = {};

app.results = {}

/**
 * Modules does a check into the LocalStore, if not there, hits DataStore, if found, saves to LocalStore
 */
app.getCurrent = function(db, key, callback) {
	var parseApp = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));
	var client = redis.createClient();
	client.on("error", function(err) {
		console.log("error event - " + client.host + ":" + client.port + " - " + err);
	});
	var found = false;
	// generate a Hash Key for Lookups
	if (typeof key != 'string') {
		var hashkey = JSON.stringify(db) + JSON.stringify(key);
	} else {
		var hashkey = JSON.stringify(db) + key;
	}
	var hashkey = crypto.createHash("md5").update(hashkey).digest("hex");
	client.get(hashkey, function(err, reply) {
		console.log('found it?', err, reply);
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
			if (response.results.length > 0) {
				var id = response.results[0].objectId;
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
	}
	callback();
}