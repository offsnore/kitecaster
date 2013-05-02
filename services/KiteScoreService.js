var restify = require('restify'),
    nconf = require('nconf'),
    validate = require('jsonschema').validate,
    Parse = require('kaiseki'),
    //winston = require('winston'),
    redis = require("redis"),
    colors = require('colors'),
    //jsonify = require("redis-jsonify"),
   // client = redis.createClient(),
    Datastore = require('./DataStore'),
    async = require('async'),
    logger = require('winston'),
    wundernode = require('wundernode');

var redisSpotIdKey = 'spot:id:counter';

var options = {
   colorize : "true"
};

var app = module.exports;

app.locals = function() {
	var api_key = nconf.get('weather:apis:wunderground');
	return {
		api_key: api_key || false,
		debug: nconf.get('weather:apis:wunderground:debug') || false
	}
};

app.current_weather = function(lat, lon, callback){
	var locals = this.locals();
	var q = lat + "," + lon;
	var db = "weather";
	Datastore.getlocalobject(db, q, function(err, res){
		if (res != null) {
			// the only thing I dont like about this .. is saves it with {body:{}}
			var res = res.body;
			callback(err, res);
		} else {
			var wunder = new wundernode(locals.api_key, locals.debug);
			wunder.forecast(q, function(err, obj){
				var obj = JSON.parse(obj);
				var obj = obj.forecast;
				Datastore.setobject(db, q, obj, 3600, function(){
					callback(err, obj);
				});
			});
		}
	});
}