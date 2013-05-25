var restify = require('restify'),
    nconf = require('nconf'),
    validate = require('jsonschema').validate,
    Parse = require('kaiseki'),
    //winston = require('winston'),
    redis = require("redis"),
    client = redis.createClient(),
    colors = require('colors'),
    //jsonify = require("redis-jsonify"),
   // client = redis.createClient(),
    Datastore = require('./DataStore'),
    async = require('async'),
    winston = require('winston'),
    SpotService = require('./SpotService'),
    ModelService = require('./ModelService'),
    wundernode = require('wundernode'),
    Forecast = require('forecast.io');

var redisSpotIdKey = 'spot:id:counter';

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
                        new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kitescore_service_server.log') })
                ],
                exceptionHandlers: [
                    new winston.transports.Console({timestamp:true}),
                    new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kitescore_service_server.log') })
                ]
        });
        
var defaultModel;
ModelService.getModel(1, function(error, model) {
   defaultModel = JSON.parse(model);
   logger.debug('Default model set: ' + JSON.stringify(defaultModel));
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
   'SW' : 255,
   'WSW': 248,
   'West'  : 270,
   'W'  : 270,
   'WNW': 293,
   'NW' : 315,
   'NNW': 338  
};

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
			// the only thing I dont like about this .. is saves it with {body:{}}
			var res = res.body;
			callback(err, res);
		} else {
		   forecast.get(lat, lon, function (err, res, data) {
           if (err) throw err;
           var obj = JSON.parse(obj);
			  var obj = obj.forecast;
				Datastore.setobject(db, q, obj, 3600, function(){
					callback(err, obj);
				});
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
         logger.debug('wind: ' + JSON.stringify(wind));
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
      callback("Unable to determine data source");
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
      console.log('hourly length: '.magenta + windData.length);
   }
   
   // ignore direction first, just map speeds
   // map TOO_LIGHT = 5, VERY_LIGHT = 6, LIGHT = 7, MED_LOW = 8, MED_MED = 9, MED_HIGH = 10, HIGH_LOW = 11, HIGH_MED = 12,  HIGH_HIGH = 13, TOO_MUCH = 15;
   //console.log('winddata: '.magenta + JSON.stringify(windData));
   windData.forEach(function(data) {
      var kiteScore = 0;
//       console.log('WindData.ForeEach data: ' + JSON.stringify(data)); 
      var speed = parseInt(data.wspd);
      var wdir  = parseInt(data.wdir);
      var wx    = data.wx;
      var hour, time;
      if (data.FCTTIME) hour  = data.FCTTIME.hour;
      else if (data.time) time = data.time;
      var rangeEnd = -1;
      if (speed <= windLowMax) {
         if (speed >= windLowMin) {
            if (speed <= windLowMid) {
               kiteScore = VERY_LIGHT;
            } else kiteScore = LIGHT;
         } else kiteScore = TOO_LIGHT;
      }
      else if (speed <= windMedMax) {  
		 // map wind into 3 steps of medium
         var step =(windMedRange / 3);
         if ((speed + step) < windMedMid) {
            kiteScore = MED_LOW;
         }
         else if ((speed + step) < windMedMid)  {
            kiteScore = MED_MED;
         }
         else if ((speed + step) > windMedMid) {
            kiteScore = MED_HIGH;
         }
      } 
      else if (speed <= windHighMax) {
	  // map wind into 3 steps of high
         var step =(windHighRange / 3);
         if ((speed + step) < windHighMid) {
            kiteScore = HIGH_LOW;
         }
         else if ((speed + step) < windHighMid)  {
            kiteScore = HIGH;
         }
         else if ((speed + step) > windHighMid) {
            kiteScore = HIGH_HIGH;
         }
      }
      else if (speed > windHighMax) {
         kiteScore = TOO_MUCH;
      }
      else {
         throw new Error('WTF happened, no kite score determined, speed: ' + speed);
         
      }
      // TODO: change score based on wind direction. generic search (query for location) without a spot cannot account for specific wind direction.
      if (spot) {
         //logger.debug('wind dir: ' + JSON.stringify(wdir));
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
/*
         logger.debug('degree mapping: ' + windDirDegrees);
         logger.debug(wdir.dir  +':' + speed + ', score: ' + kiteScore );
         logger.debug('spot wind dirs: ' + JSON.stringify(spot.wind_directions));
*/
         var closestDir = 360;;
         spot.wind_directions.forEach(function(direction) {
            var spotWindDegree = compassDegrees[direction];
            var diff = Math.abs(spotWindDegree - windDirDegrees)
            // get minimum difference
            if ( diff <  closestDir) {
               closestDir = spotWindDegree;
            }
         })
         var closestDifference = Math.abs(closestDir - windDirDegrees);
         // normalize the difference into 1/8 points to subtract from kitescore
         var kiteScoreSubtraction = closestDifference / 45;
         //logger.debug('taking off ' + kiteScoreSubtraction + ' because the closest wind dir is ' + closestDir + ' and wind degree is ' + windDirDegrees);
         
         kiteScore -= closestDifference / 45; 
      }
      //kiteScore = Math.ceil(kiteScore);
      data['kiteScore'] = Math.floor(kiteScore);
      data['lastUpdated'] = new Date().toUTCString();
      scores.push(data);
//      logger.debug('KiteScore determined for spot ' + spot.spotId + ', hour ' + hour + ': ' + kiteScore);      
   });

   callback(null, scores);
}

var cacheRunCount = 0;
var runCache = true;
var spotsBody;
// precache weather related data for spots, in seconds
app.startPrecache = function(callback, interval) {
   app.runSpotCache();
   app.runSpotWeatherCache();
   var secondsInterval;
   if (interval) 
      secondsInterval = interval * 1000;
   // 15 minute default
   else secondsInterval = 60 * 60 * 1000; 
   logger.debug('Started running precache every '.magenta + interval + ' seconds'.magenta);   
   setInterval(app.runSpotCache, secondsInterval);
   setInterval(app.runSpotWeatherCache, secondsInterval);
 
   
}

app.runSpotCache = function() {
   var queryParams = {
         count : true
      };
   // get all spots, store in redis   
   parse.getObjects('Spot', queryParams , function(err, response, body, success) {
     //     spotsBody = body;
     // logger.debug('body; ' + JSON.stringify(body));
     body.results.forEach(function(spot) {
        var spotId = spot.spotId;
        spot['lastUpdated'] = new Date().toUTCString();
        var redisSpotId = "spot:" + spotId;        
//        logger.debug('Setting spot id ' + redisSpotId + ' in redis, val: ' + JSON.stringify(spot));
        client.set(redisSpotId, JSON.stringify(spot), function(err, replies) {
//           logger.debug('key set for ' + redisSpotId + ', reply: ' + replies);
            client.expire(redisSpotId, expireTimeSpot, function(err, reply) {
               logger.debug('Expire set for spot ' + redisSpotId + ', expires: ' + expireTimeSpot / 60 + ' minutes');
            }) ;
        }); 
     });
   
/*
     client.set(redisKey, JSON.stringify(body),function(err, replies) {
  // 			logger.debug('expire set for ' + redisKey  + ', reply: ' + replies);
   		});
*/


     /*
Datastore.save("Spot", redisKey, body, function(err, response) {
        logger.debug('Dadastore data saved to resis: ' + body.count);
     });
*/

	});
	
	
	/*
   // Use DataStore 
		Datastore.records.object("Spot", queryParams, function(err, response, body, success) {
   		logger.debug("Get all spots response: " + body.length);
			//callback(err, body);
		});
*/
}

app.runSpotWeatherCache = function() {
   var spotLookupQuery = "spot:*";
   var weatherSpotKey = "weather:spot:"
   logger.debug('running runSpotWeatherCache, run count: ' + appCounter++);
   // Begin rewrite
   async.series([
    function(){
       
    },
    function(){ 
    
     }
    ], function(err, result) {
       
       
    });   
   
   /// vvvv Cut the chord from callback jungle below
   client.keys(spotLookupQuery, function(err, replies) {
      if (err) {
         logger.error('Error: ' + err);
      } else  {
         replies.forEach(function(key) {
            logger.debug('got spot id: ' + key); 
            client.get(key, function(err, reply) {
               var jsonSpot = JSON.parse(reply);
//               console.log('runSpotWeatherCache reply: ' + reply);
               try {
               console.log('Got spot geoloc for cache: ' + jsonSpot.location.latitude + ', ' + jsonSpot.location.longitude);
               } catch (err) {
                  logger.error('Error doing something: ' + err);
               }
               var lat = jsonSpot.location.latitude;
               var lon = jsonSpot.location.longitude;
               var spotId = jsonSpot.spotId;
               var redisWeatherKey = weatherSpotKey + spotId;
               logger.debug('Pulling weather for lat ' + lat + ', lon: ' + lon);
               var latLonQuery = lat + ',' + lon;
                wunder.hourly7day(latLonQuery, function(err, response) {
                  logger.debug('Got weather for latlon query: ' + latLonQuery);
                  if ( response != null ) {
                     var weather = JSON.parse(response);
                     app.processHourly(weather, function(err, hourly){
                        var weatherStr = JSON.stringify(hourly);
                        client.set(redisWeatherKey,  weatherStr,function(err, replies) {
                           logger.debug('redis key set for ' + redisWeatherKey + ', replies: ' + replies);
                           if (replies === "OK") {                     
                              // run kite scores for saved spots' weather
                              if (jsonSpot && defaultModel && weatherStr) {
                                 logger.debug('building kitescores for weather cache');
                                                      
                                 app.buildKiteScore(defaultModel, jsonSpot, weather, function(err, scores) {
                                    //console.log('Got kitescores for data: ' + JSON.stringify(scores));
                                    var redisScoresKey = "scores:7day:spot:" + jsonSpot.spotId;
                                     client.set(redisScoresKey, JSON.stringify(scores), function(err, replies) {
                                        logger.debug('redisScoresKey ' + redisScoresKey + ' set, reply: ' + replies);
                                        client.expire(redisScoresKey, expireTimeWeather, function(err, reply) {
                                           logger.debug('Redis scores key set to expire: ' + redisScoresKey + ': ' + expireTimeWeather / 60 + ' minutes');
                                        });
                                     });
                                    
                                 });
         
                              }
                           }
                           
                        });   
                     });
                     
/*
                     logger.debug('jsonSpot: ' + JSON.stringify(jsonSpot));
                     logger.debug('defaultModel: ' + JSON.stringify(defaultModel));
                     logger.debug('weather: ' +weatherStr);
*/
                     
                  }
                  else logger.error('response was null, error: ' + err);
                      
                  
                });
               
               /*    
               app.pullWeather(HOURLY_1DAY, lat, lon, function(err, weather) {
                  
   client.set(redisKey, weather, function(err, reply) {
                     logger.debug('Weather stored in redis for key: ' + redisKey);
                  });
   
               });
   */
            });
                    
         });
      }
   });
}


