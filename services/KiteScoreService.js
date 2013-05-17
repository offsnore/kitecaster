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
    wundernode = require('wundernode');

var redisSpotIdKey = 'spot:id:counter';

var options = {
   colorize : "true"
};

var app = module.exports;

var logger = new (winston.Logger)({
                transports: [
                        new winston.transports.Console({timestamp:true}),
                        new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kitescore_service_server.log') })
                        //new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kitescore_service.log') })
                ],
                exceptionHandlers: [
                    new winston.transports.Console({timestamp:true})
                    //,new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kitescore_service.log') })
                    new winston.transports.File({ timestamp:true, filename: require('path').resolve(__dirname, '../logs/kitescore_service_server.log') })
                ]
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


var scoreColors = {
    
};

if (!nconf.get("parse:appId")) {
		logger.error("Unable to locate 'Parse:AppID' in Config file (settings.json).");
		process.exit();
	}
	
var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey')); 

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
};

// the API might return data in different format. This if for handling the hourly response
app.processHourly = function(model, spot, hourly, callback) {
   var windData = [];
   hourly.hourly_forecast.forEach(function(hour) {
      var wind = {};
      wind.time = hour.FCTTIME;
      wind.wdir = hour.wdir;
      wind.wspd = hour.wspd;
      wind.wx   = hour.wx;
      windData.push(wind);
   });
   buildKiteScore(model, spot, windData, function(err, scores) {
      callback(err, scores);  
   });
};


// Crude 'algorithm'!
buildKiteScore = function(model, spot, windData, callback) {
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
   /*
logger.debug('windLowMin/Max/Mid' + windLowMin + '/' + windLowMax +'/' + windLowMid);
   logger.debug('windMedMin/Max/Mid' + windMedMin + '/' + windMedMax +'/' + windMedMid);
   logger.debug('windHighMin/Max/Mid' + windHighMin + '/' + windHighMax +'/' + windHighMid);
   
*/
   var kiteScore = 0;
   
   // ignore direction first, just map speeds
   // map TOO_LIGHT = 5, VERY_LIGHT = 6, LIGHT = 7, MED_LOW = 8, MED_MED = 9, MED_HIGH = 10, HIGH_LOW = 11, HIGH_MED = 12,  HIGH_HIGH = 13, TOO_MUCH = 15;
   windData.forEach(function(data) {
      var speed = data.wspd.english;
      var wdir  = data.wdir;
      var wx    = data.wx;
      var hour  = data.time.hour;
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
         logger.debug('WTF happened, no kite score determined');
      }
      
      // TODO: change score based on wind direction. generic search (query for location) without a spot cannot account for specific wind direction.
      if (spot) {
         //logger.debug('wind dir: ' + JSON.stringify(wdir));
         var dir = wdir.dir;
         var windDirDegrees = compassDegrees[dir];
         //logger.debug('degree mapping: ' + windDirDegrees);
         //logger.debug(wdir.dir  +':' + speed + ', score: ' + kiteScore );
         //logger.debug('spot wind dirs: ' + JSON.stringify(spot.wind_directions));
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
      data['kiteScore'] = Math.round(kiteScore);
      scores.push(data);
   });
   callback(null, scores);
}

var cacheRunCount = 0;
var runCache = true;
var spotsBody;
// precache weather related data for spots, in seconds
app.startPrecache = function(callback, interval) {
   var secondsInterval;
   if (interval) 
      secondsInterval = interval * 1000;
   // 15 minute default
   else secondsInterval = 15 * 60 * 1000; 
   logger.debug('Started running precache every '.magenta + interval + ' seconds'.magenta);   
   setInterval(app.runCache, secondsInterval);
 
   
}

app.runCache = function() {
   console.log('Running runCache');
   var queryParams = {
         count : true
      };
   parse.getObjects('Spot', queryParams , function(err, response, body, success) {
     //     spotsBody = body;
     logger.debug('found object = ', body.count, 'success: ' , success);
     // logger.debug('body; ' + JSON.stringify(body));
     var redisKey = "kitescore:spots";
     logger.debug('Saving redis key: ' + redisKey + ', val: ' + body.results.length);
     body.results.forEach(function(spot) {
        var spotId = spot.spotId;
        var redisSpotId = "spot:" + spotId;        
        logger.debug('Setting spot id ' + redisSpotId + ' in redis');
        client.set(redisSpotId, JSON.stringify(spot), function(err, replies) {
           logger.debug('key set for ' + redisSpotId + ', reply: ' + replies);
        }); 
     });
   
     client.set(redisKey, JSON.stringify(body),function(err, replies) {
   			logger.debug('expire set for ' + redisKey  + ', reply: ' + replies);
   		});


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




