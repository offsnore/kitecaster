var   redis = require("redis"),
      client = redis.createClient(),
      logger = require('winston'),
      nconf = require('nconf'),
      Parse = require('kaiseki'),
      DataStore = require('./DataStore')
;
var SpotService = {};

nconf.argv()
       .env()
       .file({ file: require('path').resolve(__dirname, '../settings.json') });

var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey')); 
var client = redis.createClient();
var redisExpireTime = 600;//parseInt(nconf.get('redis:expireTime'));


SpotService.getSpotByQuery = function(queryParams, callback){
   // Me no follow -_-
  /* Datastore.records.object("Spot", queryParams, function(err, response, body, success) {
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
   callback(err, spot)*/
};

SpotService.getSpot = function(id, callback) {
   var redisKey = 'spot:id:' + id;
   client.exists(redisKey , function (err, reply){
      if (reply === 1){
         client.get(redisKey, function (err, replies) {
            console.log('redisKey found for ' + redisKey + ': ' + replies);
            callback(null, replies);
         });
      }
      else if (reply === 0) {
         var queryParams = {
            where: {spotId : parseInt(id)   },
         };
         console.log('queryParams: ' + JSON.stringify(queryParams));
         parse.getObjects('Spot', queryParams , function(err, response, body, success) {
            console.log('found object = ', body, 'success: ' , success);
            
            var bodyJson = JSON.parse(JSON.stringify(body));
            if (body.length == 0) {
               callback("spot " + id + " doesn't exist", null);
            }
            else {
               client.set(redisKey,  JSON.stringify(bodyJson[0]), function (err, response, body, success) {
                  client.expire(redisKey, redisExpireTime, function (err, replies) {
                     console.log('expire set for ' + redisKey + ' to ' + redisExpireTime + ' seconds.');
                  });
   
               });
               callback(null, bodyJson);
            }
            
         });
      }
   });
};

module.exports =SpotService;




