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
    winston = require('winston'),
    wundernode = require('wundernode'),
    KiteScoreService = require('../services/KiteScoreService'),
    DataStore = require('../services/DataStore'),
    ModelService = require('../services/ModelService'),
    SpotService = require('../services/SpotService'),
    Forecast = require('forecast.io');
    ;
    
    
var options = {
   colorize : "true"
};


var logger = new (winston.Logger)({
		transports: [
			new winston.transports.Console({timestamp:true}),
			new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kitescore_server.log') })
		],
		exceptionHandlers: [
		   new winston.transports.Console({timestamp:true}),
			new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kitescore_server.log') })
		] 
	});

var HOURLY_1DAY = "hourly", HOURLY_7DAY = "7day", HOURLY_10DAY = "10day";

var defaultModel;

nconf.argv()
       .env()
       .file({ file: require('path').resolve(__dirname, '../settings.json') });
       

var forecast_options = {
    APIKey: nconf.get("api:forecast.io:key") //process.env.FORECAST_API_KEY
};

forecast = new Forecast(forecast_options);

var wundegroundAPI = nconf.get('weather:apis:wunderground');
var startCache = nconf.get('kitescore:start_cache') || false;
logger.debug('wunderground key: ' + wundegroundAPI); 



var wunderDebug = 	nconf.get('weather:apis:debug'),
    rateMinute = 	nconf.get('weather:apis:rate:minute'),
    rateHour = 	nconf.get('weather:apis:rate:hour'),
    rateDay = 	nconf.get('weather:apis:rate:day');
var wunder = new wundernode(wundegroundAPI, wunderDebug, rateMinute, rateHour, rateDay);
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
  console.log("%s listening at %s".blue, server.name, server.url);
});

process.argv.forEach(function (val, index, array) {
	if (val === '-p') {
		restPort = array[index+1] || DEFAULT_PORT;
	}
}); 

server.get('forecast', function(req, response) {
    var query = require('url').parse(req.url, false).query;
    var  split = query.split(',');
    var lat = split[0];
    var lon = split[1];
    if (!lat || !lon) {
       response.send(500, 'Must provide lat,lon query');
    } 
    else {
      forecast.get(lat, lon, function (err, res, data) {
        if (err) throw err;
        response.send(200, data);
        response.end();
      });
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
//      logger.debug('setting model to defaultModel:\n' + JSON.stringify(defaultModel));
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
         pullWeather(HOURLY_1DAY,lat, lon, function(err, weatherData) {
            var jsonModel = JSON.parse(defaultModel);
            if (me.model != null && weatherData != null) {
               var model = JSON.parse(me.model);

               var jsonWeather = JSON.parse(weatherData);
//               logger.debug('here after pullWeather: ' + weatherData);
               
               KiteScoreService.processHourly(model, spot, jsonWeather, function(err, scores) {
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
                  //logger.debug('processHourly response: ' + scores);
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
            logger.debug('redis key found, returning reply'); 
            res.send(200, JSON.parse(reply));
            return;
         }
      });
      wunder.hourly(queryParts.query, function(err, response) {
            var jsonModel = JSON.parse(defaultModel);
            if (me.model != null && response != null) {
               var model = me.model;
               var hourly = JSON.parse(response);
               KiteScoreService.processHourly( hourly, function(err, scores) {
                  //logger.debug('processHourly response: ' + scores);
                  client.set(redisKey, JSON.stringify(scores),function(err, replies) {
                     client.expire(redisKey, expiration_time, function (err, replies) {
               			logger.debug('expire set for ' + redisKey + ' to ' + expiration_time + ' seconds.');
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

server.get('score/7day/:id', function(req, res) {
   var spotId = req.params.id;
   if (!spotId) {
      res.send(404, "Missing spotId param");
      res.end();
   }
   var redis7DayKeyKey = "scores:7day:spot:" + spotId;
   client.get(redis7DayKeyKey, function(err, reply) {
      if (reply) {
         logger.debug("Scores found for key " + redis7DayKeyKey);         
         res.send(200, JSON.parse(reply));
      }
      else {
         res.send(404, "kite score not found for spot "  + spotId + " . You sure it exists? Check that cache too");
      }
   }); 
      
   
});

server.get('score/10day/:id', function(req, res) {
   var me = this;
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon, modelId;
   
   // modeId check
   if (queryParts.modelId) {
      modelId = queryParts.modelId;
      // need wait library to load model before continuing (callback hell?)
   }   else { 
   // set model to the default
      me.model = defaultModel;
   }
   var spotId = req.params.id;
   var redis10DayKey = "scores:10day:spot:" + spotId;
   if (!spotId) {
      res.send(404, "Missing spotId param");
      res.end();
   }
   var redis10DayKey = "scores:10day:spot:" + spotId;
   var redis10DayExpireTime = nconf.get("api:kitescore:expiration_time");
   client.get(redis10DayKey, function(err, reply) {
      if (reply) {
         logger.debug("Scores found for key " + redis10DayKey);         
         res.send(200, JSON.parse(reply));
      }
      else {
         // pull on demand
         if (spotId) {
            async.parallel([
               function(callback) {
                  console.log('GETTING MODEL'.magenta);
                  // get model if specified        
                  if (modelId){
                       console.log('returning  model ID : '.magenta + modelId);
                     ModelService.getModel(modelId, function(err, model) {
                        callback(err, JSON.parse(model));                              
                     });
                  } else {
         	     	callback(null, me.model);   
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
                  console.log('Pulling weather mode: '.magenta + HOURLY_10DAY);
                  pullWeather(HOURLY_10DAY,lat, lon, model, function(err, weatherData) {
                     var jsonModel = JSON.parse(defaultModel);
                     if (me.model != null && weatherData != null) {
                        var model = JSON.parse(me.model);
                        console.log('HERE'.red);
                        var jsonWeather = JSON.parse(weatherData);
                  //      console.log('HERE2, hourly length: '.red + JSON.stringify(jsonWeather.hourly ));
         //               logger.debug('here after pullWeather: ' + weatherData);
                        
                        var weatherKeys = Object.keys(jsonWeather);
                        
                        weatherKeys.forEach(function(key) {
                           console.log('KEY: '.red + key);
                        });
                        KiteScoreService.processHourly(jsonWeather, function(err, windData) {
                           KiteScoreService.buildKiteScore(model, spot, windData, function(err, scores) {
                                 console.log('Error: '.red + err);
                                 console.log('Scores:'.red + scores.length);
                                 
                                  client.set(redis10DayKey, JSON.stringify(scores),function(err, replies) {
                                    client.expire(redis10DayKey, redis10DayExpireTime, function (err, replies) {
                              			logger.debug('expire set for ' + redis10DayKey + ' to ' + redis10DayExpireTime + ' seconds.');
                              		});
               
                                 });
                                 res.writeHead(200, {
                                    'Content-Type' : 'application/json'
                                 });
                                 res.end(JSON.stringify(scores));                  
                              });                              
                           });

                     } else {
                     	res.send(500, "Invalid server response");
                     	res.end();
                     }
                     return; 
                  });
               });
            }
         
      }
   }); 

});

var getKeys = function(obj){
   var keys = [];
   for(var key in obj){
      keys.push(key);
   }
   return keys;
}



pullWeather = function(mode, lat, lon, model, callback) {
   var latLonQuery = lat + ',' + lon;
   var redisKey = "weather:" +  mode  + ":" +  lat+ ":" +  lon;
   console.log('redis key check: '.red + redisKey);
   // This will return a JavaScript String
   client.get(redisKey, function (err, reply) { 
        if (reply) {
         logger.debug('Weather found in redis for key ' + redisKey);
         console.log('Reply typeof:'.red + typeof reply);
         callback(null, reply);
        }
        else {
           if (mode === HOURLY_1DAY) {
             forecast.get(lat, lon, function(err, response, data) {
                  var dataStr = JSON.stringify(data);
                  var dataJson = JSON.parse(dataStr);
                  //logger.debug('Got us some forecast.io data!'.magenta + dataStr);
                  if (err) {
                     logger.error('Error running wunder.hourly: ' + err);
                     throw err;
                  }
                  var jsonModel = JSON.parse(model);
                  client.set(redisKey,  dataStr,function(err, setRepky) {
                     client.expire(redisKey, expiration_time, function (err, expireReply) {
                        logger.debug('kitescore:redis key expire set for ' + redisKey);
                        
               		});
               		//console.log('redisKey before returning weather? '.magenta + dataStr);
                 		callback(null,  dataStr);
                  
                  });
                  
             });
      
          }
          else if (mode === HOURLY_7DAY) {
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
          else if (mode === HOURLY_10DAY) {
             console.log("HERE IN HOURLY10DAY PULLWEATHER".red);
             wunder.hourly10day(latLonQuery, function(err, response) {
                  var jsonModel = JSON.parse(defaultModel);
                  console.log('Hourly 10 day returned: '.red );
                  callback(null, response);

             });
      
          } 
           
        }
    });  
   
};



