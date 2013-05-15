/** 
   This service will deliver forecast data through whichever API is being used (possibly choosing?)
**/

var restify = require('restify'),
    nconf = require('nconf'),
    validate = require('jsonschema').validate,
    Parse = require('kaiseki'),
    //winston = require('winston'),
    redis = require("redis"),
    colors = require('colors'),
    //jsonify = require("redis-jsonify"),
    client = redis.createClient(),
    async = require('async'),
    logger = require('winston'),
    wundernode = require('wundernode'),
    KiteScoreService = require('../services/KiteScoreService'),
    DataStore = require('../services/DataStore'),
    ModelService = require('../services/ModelService'),
    SpotService = require('../services/SpotService')
    ;
    
    
var options = {
   colorize : "true"
};

var HOURLY_1DAY = "hourly", HOURLY_7DAY = "7day", HOURLY_10DAY = "10day";

var defaultModel;

nconf.argv()
       .env()
       .file({ file: require('path').resolve(__dirname, '../settings.json') });
       
var wundegroundAPI = nconf.get('weather:apis:wunderground');

console.log('wunderground key: ' + wundegroundAPI); 



var rateCount = 	nconf.get('weather:apis:rate:count'), rateTime = nconf.get('weather:apis:rate:time');;
var wunder = new wundernode(wundegroundAPI, false, rateCount, rateTime);
var expiration_time = nconf.get("api:kitescore:expiration_time");

var api = {};
api.queryParams = {
   GET : {
      geoloc : {"[lat,lon]" : "Lattitude,Longitude","tested": false },
      lat : "Lattitude (required with lon)",
      lon : "Longitude (required with lat)",
      days: "[defaults to 7] - specify number of days for forecast",
      date: "get a specificy date's forecast (within max range)",
      spotId: "Get kitescore for spot",
      modelId: "use specific model for kitescore calculation"
   },
};


// Create server
var server = restify.createServer();

//----- 

ModelService.getModel(1, function(error, modelJson) {
   defaultModel = modelJson;
});

//-----

var DEFAULT_PORT = 7503;
var restPort;
if (nconf.get('api:kitescore:port'))
   restPort = nconf.get('api:kitescore:port');
else restPort = DEFAULT_PORT;

server.listen(restPort, function() {
  console.log('%s listening at %s'.blue, server.name, server.url);
});

process.argv.forEach(function (val, index, array) {
	if (val === '-p') {
		restPort = array[index+1] || DEFAULT_PORT;
	}
}); 

server.get('score/api', function(req, res) {
    res.send(api);
});

server.get('score/today', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon, query, spotId, modelId, model;
   var me = this;
   var queryParams = {
         //limit : limit,
         count: true        
         };
   
	// location parameters
	if (queryParts.geoloc) {
		logger.debug('geoloc: '.red + queryParts.geoloc);
		lat = Number(queryParts.geoloc.split(/,/)[0]);
		lon = Number(queryParts.geoloc.split(/,/)[1]);
	} else if (queryParts.lat && queryParts.lon) {
		lat = Number(queryParts.lat);
		lon = Number(queryParts.lon);
	} else if (queryParts.spotId) {
		spotId = queryParts.spotId; 
	}
   
   // modeId check
   if (queryParts.modelId) {
      modelId = queryParts.modelId;
      // need wait library to load model before continuing (callback hell?)
   }   else { 
   // set model to the default
      me.model = defaultModel;
//      console.log('setting model to defaultModel:\n' + JSON.stringify(defaultModel));
   }
   
   var validEntry = (spotId != null ||  (lat != null && lon != null) || queryParts.query != null);
   
   if ( !validEntry ) {
      res.send(400, "Bad request, must specify location or spot");
      return;
   } else {
      if (lat && lon) {
      } 
   }

   if (spotId) {
   async.parallel([
      function(callback) {
         // get model if specified        
         if (modelId){
            ModelService.getModel(modelId, function(err, model) {
               callback(err, JSON.parse(model));                              
            });
         } else {
	     	callback(null, JSON.parse(defaultModel));   
         }
      },
      function(callback) {
         // get spot if specified
         if (spotId) {
             SpotService.getSpot(parseInt(spotId), function(err, spot) {
               callback(err, spot[0]);                              
            });
         } else {
	         callback("no spot ID Specified", null);
         }
      }],
      function(err, results) {
         model = results[0];
         spot = results[1];
         var lat = spot.location.latitude;
         var lon = spot.location.longitude;
         var latLonQuery = lat + ',' + lon;
         console.log('wunder.hourly with query: ' + latLonQuery);
         pullWeather(HOURLY_1DAY,lat, lon, function(err, response) {
            var jsonModel = JSON.parse(defaultModel);
            if (me.model != null && response != null) {
               var model = JSON.parse(me.model);
               var hourly = JSON.parse(response);
               KiteScoreService.processHourly(model, spot, hourly, function(err, scores) {
                  res.writeHead(200, {
                     'Content-Type' : 'application/json'
                  });
                  res.end(JSON.stringify(scores));                  
               });
            } else {
            	res.send(500, "Invalid server response");
            	res.end();
            }
            return; 
         });
         /*wunder.hourly(latLonQuery, function(err, response) {
            var jsonModel = JSON.parse(defaultModel);
            if (me.model != null && response != null) {
               var model = JSON.parse(me.model);
               var hourly = JSON.parse(response);
               KiteScoreService.processHourly(model, spot, hourly, function(err, scores) {
                  //console.log('processHourly response: ' + scores);
                  res.send(200, scores);
                  res.end();
               });
            } else {console.error('uhhh');
               res.send(500, "Invalid server response");
               res.end();
            }
            return;
       });*/
      });
   }
   else if (queryParts.query) {
      // first query for location
      var redisKey = "kitescore:query:" + queryParts.query;
      client.get(redisKey, function (err, reply) {
        if (reply)  {
            console.log('redis key found, returning reply'); 
            res.send(200, JSON.parse(reply));
            return;
         }
      });
      wunder.hourly(queryParts.query, function(err, response) {
            var jsonModel = JSON.parse(defaultModel);
            if (me.model != null && response != null) {
               var model = me.model;
               var hourly = JSON.parse(response);
               KiteScoreService.processHourly(jsonModel, null, hourly, function(err, scores) {
                  //console.log('processHourly response: ' + scores);
                  client.set(redisKey, JSON.stringify(scores),function(err, replies) {
                     client.expire(redisKey, expiration_time, function (err, replies) {
               			console.log('expire set for ' + redisKey + ' to ' + expiration_time + ' seconds.');
               		});

                  });
                  res.send(200, scores);
                  res.end();
               });
            } else {console.error('uhhh');
               res.send(500, "Invalid server response");
               res.end();
            }
            return;
       });
      
   }
   
});

server.get('score/tomorrow', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon;
});

server.get('score/7day', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon;
});

server.get('score/10day', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon;
});

pullWeather = function(mode, lat, lon,  callback) {
   var latLonQuery = lat + ',' + lon;
   var redisKey = "kitescore:" +  mode  + ":" +  lat+ ":" +  lon;
   // This will return a JavaScript String
   client.get(redisKey, function (err, reply) { 
        if (reply) {
           callback(null, reply);
        }
        else {
           if (mode = HOURLY_1DAY) {
             wunder.hourly(latLonQuery, function(err, response) {
                  var jsonModel = JSON.parse(defaultModel);
                  if ( response != null ) {
                     var weather = JSON.parse(response);
                     var weatherStr = JSON.stringify(weather);
                     client.set(redisKey,  JSON.stringify(weather),function(err, replies) {
                           client.expire(redisKey, expiration_time, function (err, replies) {

                     		});
                     callback(null, response);
                     });
                  }
                      
                  
                  else {
                     callback("invalid response");
                  }
             });
      
          }
          else if (mode = HOURLY_7DAY) {
             wunder.hourly7day(latLonQuery, function(err, response) {
                  var jsonModel = JSON.parse(defaultModel);
                  if ( response != null ) {
                     var weather = JSON.parse(response);
                     callback(null, weather);
                  } else {
                     callback("invalid response");
                  }
             });
      
          } 
          else if (mode = HOURLY_10DAY) {
             wunder.hourly10day(latLonQuery, function(err, response) {
                  var jsonModel = JSON.parse(defaultModel);
                  if ( response != null ) {
                     var weather = JSON.parse(response);
                     callback(null, weather);
                  } else {
                     callback("invalid response");
                  }
             });
      
          } 
           
        }
    });  
   
};






