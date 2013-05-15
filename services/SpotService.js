var   redis = require("redis"),
      client = redis.createClient(),
      logger = require('winston'),
      nconf = require('nconf'),
      Parse = require('kaiseki'),
      jsonp = require('jsonp-handler'),
      DataStore = require('./DataStore')
;
var SpotService = {};

nconf.argv()
       .env()
       .file({ file: require('path').resolve(__dirname, '../settings.json') });

var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey')); 
var client = redis.createClient();


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
		var queryParams = {
			where: {
				spotId: id
			}
		};
		DataStore.records.object("Spot", queryParams, function(err, response, body, success) {
			if (body.length == 0) {
				obj = {"error":"Spot " + id + "not found."};
			} else {
				obj = body;
			}
			// gets Spots within certain distance of THIS spot (for mapping)		
			callback(err, obj);

			
		});
   /* broked
   var redisKey = 'spot:id:' + id;
   client.exists(redisKey , function (err, reply){
      if (reply === 1){
         client.get(redisKey, function (err, replies) {
            console.log('redisKey found for ' + redisKey + ': ' + replies);
            callback(null, replies);
         });
      }
      else if (reply === 0) {
         console.log('redis key not found for ID: ' + id);
         var queryParams = {
            where: {spotId : parseInt(id)   },
         };
         console.log('spot queryParams: ' + JSON.stringify(queryParams));
         parse.getObjects('Spot', queryParams , function(err, response, body, success) {
            console.log('found spot= ', body, 'success: ' , success);
            
            if (body.length == 0) {
               callback("spot " + id + " doesn't exist", null);
            }
            else {
               client.set(redisKey,  JSON.stringify(body), function (err, response, body, success) {
                  console.log('client.set: ' + JSON.stringify(body));
                  client.expire(redisKey, redisExpireTime, function (err, replies) {
                     console.log('expire set for ' + redisKey + ' to ' + redisExpireTime + ' seconds.');
                  });
   
               });
               console.log('WHY HERE, body from Spot ID response: '.rainbow + body);
               callback(null, body);
            }
            
         });
      }
   });
   */
};

module.exports =SpotService;




