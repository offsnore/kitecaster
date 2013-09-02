var restify = require('restify'),
    nconf = require('nconf'),
    validate = require('jsonschema').validate,
    Parse = require('kaiseki'),
    redis = require("redis"),
    client = redis.createClient(),
    colors = require('colors'),
    Datastore = require('./DataStore'),
    async = require('async'),
    winston = require('winston'),
    SpotService = require('./SpotService'),
    ModelService = require('./ModelService'),
    SessionFinderService = require('./SessionFinderService'),
    wundernode = require('wundernode'),
    Forecast = require('forecast.io');

var redisSpotIdKey = 'counter:spot:id';

var options = {
   colorize : "true"
};


var forecast_options = {
    APIKey: nconf.get("api:forecast.io:key") //process.env.FORECAST_API_KEY
};

forecast = new Forecast(forecast_options);



var app = module.exports;
var HOURLY_1DAY = "hourly", HOURLY_7DAY = "7day", HOURLY_10DAY = "10day";
var logger = new (winston.Logger)({
                transports: [
                        new winston.transports.Console({timestamp:true}),
                        new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kitescore_service.log') })
                ],
                exceptionHandlers: [
                    new winston.transports.Console({timestamp:true}),
                    new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kitescore_service.log') })
                ]
        });
        
var defaultModel;
ModelService.getModel(1, function(error, model) {
	if (typeof model != 'undefined') {
		defaultModel = JSON.parse(model);
		logger.debug('Default model set: ' + JSON.stringify(defaultModel));		
	} else {
		logger.debug("Error finding model set: " + JSON.stringify(error));
	}
});
		
var compassDegrees = {
   'North'  : 0,
   'N'  : 0,
   'NNE': 23,
   'NE' : 45,
   'ENE': 68,
   'East'  : 90,
   'E'  : 90,
   'ESE': 113,
   'SE' : 135,
   'SSE': 158,
   'South'  : 180,
   'S'  : 180,
   'SSW': 203,
   'SW' : 225,
   'WSW': 248,
   'West'  : 270,
   'W'  : 270,
   'WNW': 293,
   'NW' : 315,
   'NNW': 338  
};

var getBearingDirection = function(bearing) {
   var bearingInt = 0;
   try {
      bearingInt = parseInt(bearing, 10);
   } catch (Error) {
      console.log('Error parsing int: ' + bearing);
      return "error";
   }
   var compassArray = [ 'N', 'NNE', 'NE', 'ENE', 'E',
    'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW' ];
   var dir = compassArray[Math.floor((((bearing * 100) + 1125) % 36000) / 2250)];
   return dir;
}

// color range: grey, dark grey, light green, green, dark green, orange, red, pink
// score 0-8? ideal conditions 4-6 (e.g. 18-28mph)
// with low, med, high wind (split in 2 for low/high end), plus one for (no kite), one for (too much wind (pink))
/* 
   0 - too light
   1 - super light
   2 - light
   3 - med-low
   4 - med - ideal?
   5 - med-high
   6 - high-low
   7 - high-high
   8 - too windy (beyond top range)
   
   scale to 10 so ideal = 10?
   05 - too light - light gey (racer?)
   06 - very light- darg grey (racers)
   07 - light     - light green (big kite) 
   08 - med-low   - green
   09 - med-ideal?- dark green
   10 - med-high  - orange (perfect for all general kiters)
   11 - high-low  - red
   12 - high-high - dark red
   13 - too windy - pink/black (beyond top range, dangerous, specialized)
*/

var TOO_LIGHT = 5, VERY_LIGHT = 6, LIGHT = 7, MED_LOW = 8, MED_MED = 9, MED_HIGH = 10, HIGH_LOW = 11, HIGH_MED = 12,  HIGH_HIGH = 13, TOO_MUCH = 14;

var appCounter = 0;
var scoreColors = {
    
};

if (!nconf.get("parse:appId")) {
		logger.error("Unable to locate 'Parse:AppID' in Config file (settings.json).");
		process.exit();
	}
	
var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey')); 

var wundegroundAPI = nconf.get('weather:apis:wunderground'),
    wunderDebug = 	nconf.get('weather:apis:debug'),
    rateMinute = 	nconf.get('weather:apis:rate:minute'),
    rateHour = 	nconf.get('weather:apis:rate:hour'),
    rateDay = 	nconf.get('weather:apis:rate:day'),
    expireTimeSpot = nconf.get('redis:expire_time:spot'),
    expireTimeWeather = nconf.get('redis:expire_time:weather');

var wunder = new wundernode(wundegroundAPI, wunderDebug, rateMinute, 'minute');

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
			var res = res.body;
			callback(err, res);
		} else {
			forecast.get(lat, lon, function (err, res, data) {
				if (err) throw err;
				if (typeof data != 'undefined') {
					var obj = {};
					obj.forecast = data;
					Datastore.setobject(db, q, obj, 3600, function(){
						callback(err, obj);
					});
				} else {
					callback(err, {});
				}
			});
			/*
			wunder.forecast(q, function(err, obj){
				var obj = JSON.parse(obj);
				var obj = obj.forecast;
				Datastore.setobject(db, q, obj, 3600, function(){
					callback(err, obj);
				});
			});
		*/
		}   
	});
};

// the API might return data in different format. This if for handling the hourly response
app.processHourly = function(hourly, callback) {
   var windData = [];

   // wundernode
   if (hourly.hourly_forecast) {
      logger.debug ('Running wundernode data ingest');
      hourly.hourly_forecast.forEach(function(hour) {
         var wind = {};
         wind.time = hour.FCTTIME;
         wind.wdir = hour.wdir.degrees;
         wind.wspd = hour.wspd.english;
         wind.wx   = hour.wx;
         wind.temp = hour.temp;
         wind.icon_url = hour.icon_url;
         windData.push(wind);
      });
      
   }
   // forecast.io
   else if (hourly.hourly) {
      hourly.hourly.data.forEach(function(data) {
         logger.debug('Running forecast.io data ingest');
         var wind = {};
         wind.time = new Date(data.time*1000).toTimeString();
         wind.wdir = data.windBearing;
         wind.wspd = data.windSpeed;
         wind.wx   = data.summary;
         windData.push(wind);
      });      
   }
   else {
      console.log('what the fuck'.red);
      //callback("Unable to determine data source", null);
   }
   
   callback(null, windData);   
   // shouldn't build kitescore here
/*
   app.buildKiteScore(model, spot, windData, function(err, scores) {
         if (err)  {
            logger.error('Error running kitescoresservice.buildkitescore: ' +err);
            throw err;
         }
         callback(err, scores);  
      });
*/
};


// Crude 'algorithm'!
app.buildKiteScore = function(model, spot, windData, callback) {
   var scores = [];
   var windLowMin = model.wind_low.min;
   var windLowMax = model.wind_low.max;
     
   var windLowMid = ( windLowMin + windLowMax ) / 2;
   var windMedMin = model.wind_med.min;
   var windMedMax = model.wind_med.max; 
   var windMedMid = ( windMedMin + windMedMax ) / 2;
   var windHighMin = model.wind_high.min;
   var windHighMax = model.wind_high.max;
   var windHighMid = ( windHighMin + windHighMax ) / 2;
   var windLowRange = windLowMax - windLowMin;
   var windMedRange = windMedMax - windMedMin;
   var windHighRange = windHighMax - windHighMin; 

   if (windData.hourly_forecast) {
      windData = windData.hourly_forecast;

   }
   
   // ignore direction first, just map speeds
   // map TOO_LIGHT = 5, VERY_LIGHT = 6, LIGHT = 7, MED_LOW = 8, MED_MED = 9, MED_HIGH = 10, HIGH_LOW = 11, HIGH_MED = 12,  HIGH_HIGH = 13, TOO_MUCH = 15;

	// we want a nice return, not Node.JS going fuck you.   
	if (typeof windData == 'undefined') {
		return false;
	}

   windData.forEach(function(data) {
      var returnData = {};
      var kiteScore = 0;
    //console.log('WindData.ForeEach data: ' + JSON.stringify(data)); 
      var speed = 0;
      if (typeof data.wspd === 'object') {
         speed = parseInt(data.wspd.english);
      } else {
         speed = parseInt(data.wspd);
      }

      var wdir;//  = parseInt(data.wdir);

      if (data.wdir.degrees) {
         wdir = data.wdir.degrees;
      } else {
          wdir = data.wdir;
      }
      
      var wx    = data.wx;
      var hour, time;
      if (data.FCTTIME) {
         data.time = data.FCTTIME;
         delete data.FCTTIME;
      }
   
      var rangeEnd = -1; 
   
      if (speed <= windLowMax) {
         if (speed >= windLowMin) {
            if (speed <= windLowMid) {
               kiteScore = VERY_LIGHT;
            } else {
            	kiteScore = LIGHT;
            }
         } else {
         	kiteScore = TOO_LIGHT;
         }
      } else if (speed <= windMedMax) {  
		 // map wind into 3 steps of medium
         var step =(windMedRange / 3);
         if ((speed + step) < windMedMid) {
            kiteScore = MED_LOW;
         } else if ((speed + step) < windMedMid)  {
            kiteScore = MED_MED;
         } else if ((speed + step) > windMedMid) {
            kiteScore = MED_HIGH;
         }
      } else if (speed <= windHighMax) {
	  // map wind into 3 steps of high
         var step =(windHighRange / 3);
         if ((speed + step) < windHighMid) {
            kiteScore = HIGH_LOW;
         } else if ((speed + step) < windHighMid)  {
            kiteScore = HIGH;
         } else if ((speed + step) > windHighMid) {
            kiteScore = HIGH_HIGH;
         }
      } else if (speed > windHighMax) {
         kiteScore = TOO_MUCH;
      } else {
         console.log('Why is I here, speed is: '.red + speed + ', type: ' + typeof speed + '. source: ' + JSON.stringify(data.wspd) + '. parsed: '  + parseInt(data.wspd));
         throw new Error('WTF happened, no kite score determined');
         // @note - this should be a nice error, with a console.log // thorw new causes node.js to die :P
      }
      
      // wunderground
      if (wdir.dir ) {
         var dir = wdir.dir;
         windDirDegrees = parseInt(compassDegrees[dir]);
      } 
      // forecast.io
      else {
         windDirDegrees = wdir;
      }
      var windDirDegrees;         
      
      var closestDir = 360, closestDiff = 360;
      spot.wind_directions.forEach(function(direction) {
         var spotWindDegree = compassDegrees[direction];

         var diff = Math.abs(spotWindDegree - windDirDegrees);
         // get minimum difference
         if ( diff <  closestDiff) { 
            closestDir = spotWindDegree;
            closestDiff = diff;
         }
      })
      var closestDifference = Math.abs(closestDir - windDirDegrees);
      // normalize the difference into 1/8 points to subtract from kitescore
      var kiteScoreSubtraction = closestDifference / 45;
      data['kitescore_orig'] = kiteScore;
      if (spot.wind_directions.length != null && spot.wind_directions.length > 0) {
         // handle the case where no wind direction is specified, so any direction 'works'
         kiteScore -= ( 2 * Math.floor(kiteScoreSubtraction) );
      }
      
      var floorScore = Math.floor(kiteScore);
      returnData['epoch'] = data.time.epoch;
      returnData['wdir'] = wdir;
      returnData['wspd'] = speed;

      // incase weather breaks
      if (data.temp) {
          returnData['temp_c'] = data.temp.metric;
          returnData['temp_f'] = data.temp.english;
      }

      returnData['condition'] = data.condition;
      returnData['icon'] = data.icon;
      returnData['icon_url'] = data.icon_url;
      returnData['wdir_compass'] = getBearingDirection(wdir);
      returnData['timestamp'] = data.time.civil;
      returnData['ampm'] = data.time.ampm;
      returnData['datestamp'] = data.time.mon_padded + '-' + data.time.mday_padded + '-' + data.time.year;
      returnData['closest_spot_direction_degrees'] = closestDir;
      returnData['closest_spot_direction'] = getBearingDirection(closestDir);
      returnData['kiteScore'] = floorScore < 0 ? 0 : floorScore ;
      returnData['lastUpdated'] = new Date().toUTCString();
      returnData['kitescore_subtraction'] = kiteScoreSubtraction;
      scores.push(returnData);
      
//      logger.debug('KiteScore determined for spot ' + spot.spotId + '(dirs ' + spot.wind_directions+') at ' + data.FCTTIME.pretty + ': ' + data['kiteScore'] + "(" + speed  +data.wdir.dir  +")");      
   });
   callback(null, scores);
}
 
var cacheRunCount = 0; 
var runCache = true;
var spotsBody;
// precache weather related data for spots, in seconds
app.startPrecache = function(callback, interval) {
   async.waterfall([
      function(callback) 
      {
         console.log('calling runSpotCache'.red);
         app.runSpotCache(function(err, result) {
            callback(null, 'done');   
         });      
         console.log('calling back runSpotCache'.red);
         
      },
      function(err, callback) {
         console.log('calling runSpotWeatherCache'.red);
         app.runSpotWeatherCache(null, function(err, result){
            callback(null, 'done');                   
         });
         console.log('calling back runSpotWeatherCache'.red);

      },
      function(err, callback) {
         var secondsInterval;
         if (interval) 
            secondsInterval = interval * 1000;
         // 15 minute default
         else secondsInterval = 60 * 60 * 1000; 
         setInterval(app.runSpotCache, secondsInterval);
         setInterval(app.runSpotWeatherCache, secondsInterval);     
      }   
   ], function (err ,resp){
      console.log('async series run response: ' + JSON.stringify(resp));
   });
   
   
  
 
   
}

app.runIndividualSpotCache = function(spot_id, callback) {
	var queryParams = {
		count : true,
		'where': {
			'spotId': spot_id
		}
	};
    // get all spots, store in redis   
	parse.getObjects('Spot', queryParams , function(err, response, body, success) {
		body.results.forEach(function(spot) {
			var spotId = spot.spotId;
			spot['lastUpdated'] = new Date().toUTCString();
			var redisSpotId = "spot:" + spotId;        
			client.set(redisSpotId, JSON.stringify(spot), function(err, replies) {
				/*client.expire(redisSpotId, expireTimeSpot, function(err, reply) {
					logger.debug('Expire set for spot redis key \'' + redisSpotId + '\', expires: ' + expireTimeSpot / 60 + ' minutes');
				});*/
			});
		});
		callback(err, body);
	});
}


app.runSpotCache = function(callback) {
	var queryParams = {
		count : true
	};
    // get all spots, store in redis   
	parse.getObjects('Spot', queryParams , function(err, response, body, success) {
	   console.log('Im here! body length: '.red + body.results.length);
	   var size = body.results.length;
	   var processed = 0;
		body.results.forEach(function(spot) {
			var spotId = spot.spotId;
			spot['lastUpdated'] = new Date().toUTCString();
			var redisSpotId = "spot:" + spotId;        
			client.set(redisSpotId, JSON.stringify(spot), function(err, replies) {
				client.expire(redisSpotId, expireTimeSpot, function(err, reply) {
					logger.debug('Expire set for spot ' + redisSpotId + ', expires: ' + expireTimeSpot / 60 + ' minutes');
				});
			});
			console.log('processed: ' + ++processed);
			if (processed == size){
   			callback(null, processed);
				console.log('leaving runSpotCache'.red);
			}
		});


	});
}

// Runs assuming spots are cached in redis
app.runSpotWeatherCache = function(spot_id, callback) {
   var spotLookupQuery = "spot:*";
   var weatherSpotKey = "weather:spot:"
   logger.debug('running runSpotWeatherCache, run count: ' + appCounter++);

   if (spot_id) {
	   var spotLookupQuery = "spot:" + spot_id;
   }
   

   // Set the model (this should be personalized later
   var model = defaultModel;
   
      
   /// vvvv Cut the chord from callback jungle below
   client.keys(spotLookupQuery, function(err, replies) {
      var redisWeatherKey = null;
      if (err) {
         logger.error('Error: ' + err);
      } else  {
         var size = replies.length;
         var processed = 0;
         replies.forEach(function(key) {
         console.log('building kitescores for key: ' + key);
         // iterating over an individual spot to build its cache
         async.waterfall([
            // step 1: get the spot
            function(callback) {
               client.get(key, function(err, spot) {               

                  callback(null, spot);
               })
            },
            // step 2: parse spot string to json, pull weather
            function(spotStr, callback) {
               var spot = JSON.parse(spotStr);
               var lat = spot.location.latitude;
               var lon = spot.location.longitude;
               var latLonQuery = lat + ',' + lon;
               wunder.hourly10day(latLonQuery, function(err, response) {
                  callback(null, spot, response);              
               });
            },
            // step 3: convert the weather data into wind hourly data array
            function( spot, weather, callback) {
               var jsonWeather = JSON.parse(weather); 
               app.processHourly(jsonWeather, function(err, hourly) {
                  if (err) {
                     logger.warn('Error processing hourly: ' + err + ', input: ' + JSON.stringify(hourly));
                     callback(err);
                  }
                  callback(null, spot, hourly);
               });
            },
            // step 4 [optional]: store weather in redis. (why?) comment that sheet out!
            function(spot, hourly, callback) {
               var weatherStr = JSON.stringify(hourly);
               var  redisWeatherKey = weatherSpotKey + spot.spotId;
               client.set(redisWeatherKey,  weatherStr,function(err, replies) {
                  logger.debug('redis key set for ' + redisWeatherKey + ', replies: ' + replies);
                  callback(null, spot, hourly);
               });
            },
            // step 5: build the kitescore from the hourly data
            function (spot, hourlies, callback) {
               app.buildKiteScore(model, spot, hourlies, function(err, scores) {                  
                  callback(null,spot,  scores);  
               });

            },
            // step 6: cache scores in redis
            function( spot, scores, callback) {
               //console.log('Got kitescores for data: ' + JSON.stringify(scores));
               var redisScoresKey = "scores:10day:spot:" + spot.spotId;
               if (err) {
                   logger.error("Error building kitescores");
                   callback(err);
                }
               else {
                  var scoresStr = JSON.stringify(scores);
                  client.set(redisScoresKey, scoresStr, function(err, replies) {
                      logger.debug('redisScoresKey ' + redisScoresKey + ' set, reply: ' + replies);
                      /*client.expire(redisScoresKey, expireTimeWeather, function(err, reply) {
                         logger.debug('Redis scores key set to expire: ' + redisScoresKey + ': ' + expireTimeWeather / 60 + ' minutes');
                      });*/
                      processed++;
                   });               
                   callback(null, spot, scores);
                }
                
            },
            // step 7: pass scores to sesson finder service
                function(spot, scores, callback) {
                  var redisSessionFinderKey = "sessionfinder:spot:" + spot.spotId;         
                  SessionFinderService.buildSessionSearch(spot, scores, function(err, spotSessionData){
/*
                      console.log('Got session finder data for spot: ' + spot.spotId);
                      console.log("session finder data: " + JSON.stringify(spotSessionData));
*/
                      client.set(redisSessionFinderKey, JSON.stringify(spotSessionData), function(err, reply) {
                         logger.debug(redisSessionFinderKey + ': data set: ' + reply);
                        /* sick of this ssh33t expiring! And, why expire at the weather expire time? garargh!
                         client.expire(redisScoresKey, expireTimeWeather, function(err, reply) {
                            logger.debug('Redis scores key set to expire: ' + redisScoresKey + ': ' + expireTimeWeather / 60 + ' minutes');
                         });*/
                      });
                  });
                  callback(null, spot, scores)
                }   
         
         ], function( err, spot, scores){
               logger.debug("Score successfully processed for spot " + spot.spotId + ": " + scores.length);
               callback(null, scores);
            });                          
         });
      }
   });
}



