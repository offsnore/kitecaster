var redis = require('redis')
  , nconf = require('nconf')
  , crypto = require('crypto')
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
//			app.results = reply;
			app.results = JSON.parse(reply);
			var found = true;
		}
	
		console.log("looking for key: ", hashkey);
		console.log("Did we find it? ", found);
		
		if (!found) {
			// try and hit the DB
			parseApp.find(db, key, function (err, response) {
				app.results = response;
				client.set(hashkey, JSON.stringify(app.results));
				callback(app.results);
			});
		} else {
			client.quit();
			callback(app.results);
		}
	});
}
