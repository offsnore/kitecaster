var restify = require('restify'),
    nconf = require('nconf'),
    validate = require('jsonschema').validate,
    Parse = require('kaiseki'),
    //winston = require('winston'),
    redis = require("redis"),
    //colors = require('colors'),
    //jsonify = require("redis-jsonify"),
    client = redis.createClient();
    /*
colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow', 
  debug: 'blue',
  error: 'red'
});
*/
var logger = {}; logger.debug = console.log; logger.info = console.log;

/*    
var logger = new (winston.Logger)({
    transports: [
      new winston.transports.Console(timestamp:true),
      new winston.transports.File({ filename: '../logs/spot.log' })
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: '../logs/spot-exceptions.log' })
    ]
  });
  
 */ 
//logger.info('Spot restify client started'.help);

nconf.argv()
       .env()
       .file({ file: '../settings.json' });   
   
var DEFAULT_PORT = 8080;
var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey')); 
var restPort = DEFAULT_PORT;

var spotSchema = {
   "id": "/SimpleSpot",
      "type":"object",
      "properties" : {
         "lat" : {"type":"number", "required": true},
         "lon" : {"type":"number", "required": true},         
         "name" : {"type":"string", "required": true},
         "description" : {"type":"string"},
         "wind_directions": {
           "type": "array",
           "items": {"type": "string"},
           "required":true
           
         },
         "keywords": {
            "type": "array",
            "items" : {"type":"string"},
            "required": false
         }
      }      
}


if (nconf.get('api:spot:port'))
   restPort = nconf.get('api:spot:port');

process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
  if (val === '-p')
   {
      restPort = array[index+1] || DEFAULT_PORT;
   }
}); 


// Create server
var server = restify.createServer();

//-----

server.listen(restPort, function() {
  console.log('%s listening at %s', server.name, server.url);
});

/**
   SPOT API
**/

/**
   ~~ HTTP GET 
   @geoloc - tested
   @lat,@lon - tested
   @keywords [...,...] - tested
   @description =[] - tested
   @mode [filter,compound] - tested
   @limit  - number of results to return - tested
   @miles/km
   @radians
   
**/
server.get('/spot', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon, distance = 30000, limit = 10, queryParams = {}, distanceFormat;
   var redisKey = "spot:search:", redisExpireTime = nconf.get('redis:expireTime') * 1000, redisExpire = true;

   if (queryParts.geoloc) {
      logger.debug('geoloc: '.red + queryParts.geoloc);
      lat = Number(queryParts.geoloc.split(/,/)[0]);
      lon = Number(queryParts.geoloc.split(/,/)[1]);
      redisKey += queryParts.geoloc
      logger.debug("redisKey" + redisKey.red);
   }
   else if (queryParts.lat && queryParts.lon) {
      lat = Number(queryParts.lat);
      lon = Number(queryParts.lon);
      redisKey += lat + ',' + lon;
   }
   
   logger.debug('redisKey: ' + redisKey);
//   logger.debug('limit: ' + queryParts.limit.red);
   if (queryParts.limit) {
      limit =  Number(queryParts.limit);
      queryParams.limit = limit;
   }
   if (queryParts.miles){
      distanceFormat = "$maxDistanceInMiles";
      distance =  Number(queryParts.miles);
   }
   else if (queryParts.km)
   {
      distanceFormat = "$maxDistanceInKilometers";
      distance =  Number(queryParts.km);
   } 
   else if (queryParts.radians) {
      distanceFormat = "$maxDistanceInRadians";
      distance =  Number(queryParts.radians);
   }
    
   // Search for name
   if (queryParts.name) {
   queryParams.where = {
         name: queryParts.name
      }
   redisKey += queryParts.name;
   }
   
   else if (queryParts.description) {
      queryParams.where = {
         description: queryParts.description
      }
      redisKey += queryParts.description;
   }
   else if (queryParts.keywords) {
      var mode = 'compound';
      redisKey += ":keywords:";
      if (queryParts.mode && (queryParts.mode === "compound" || queryParts.mode === "filter")){
         mode = queryParts.mode;
         console.log('redisKey: ' + redisKey);
      } 
       
      var arr = queryParts.keywords.split(/,/);
      if (mode === "compound") {
         
         var params = "{ \"$or\":[";
         arr.forEach(function(item){
            console.log('item: ' + item);
            params += "{\"keywords\":\"" + item + "\"},"
            redisKey +=  item + ',';  
            console.log('redisKey: ' + redisKey);
         });
         // remove trailing comma
         params = params.substring(0, params.length-1);
         redisKey = redisKey.substring(0, redisKey.length-1);         
         params += "]}"; // close out the json object
         queryParams.where = params;
      }
      else if (mode === "filter") {
         var params = "{";
         arr.forEach(function(item){
            console.log('item: ' + item);
            params += "\"keywords\":\"" + item + "\","
         });
         // remove trailing comma
         params = params.substring(0, params.length-1);
         params += "}"; // close out the json object
         queryParams.where = params;
      }
      console.log('params: ' + params);
      var json = JSON.parse(params);
      console.log('jsonified: ' + JSON.stringify(json));
      //queryParams = json;
      logger.debug('keywords params: ' + JSON.stringify(queryParams));
      
   }
   else if (lat && lon) {      
      var log = 'here: lat:' + lat + ', lon:' + lon;
      console.log(log.red);
      // query with parameters
      queryParams = {
         limit : limit,
         where : {
           location: {
            "$nearSphere" : {
                __type: 'GeoPoint',
                latitude: lat,
                longitude: lon,
                limit : limit
                }
            ,"$maxDistanceInMiles": distance
            
           }
        }
      }
   }
   
  if (distance == -1) {
      delete params.maxDistanceInMiles;
      logger.debug("params after delete: " + JSON.stringify(params));
   }
   logger.debug('queryParams: ' + JSON.stringify(queryParams));
   var resp, dateStart, dateEnd, diff;
   client.exists(redisKey , function (err, replies){
      console.log('queryParams stringified: ' + redisKey);
      console.log('redisKey ' + redisKey + ' exists? ' + replies);
      if (replies === 1){
         dateStart = new Date().getUTCMilliseconds();
         client.get(redisKey, function(err, replies) { 
            dateEnd = new Date().getUTCMilliseconds();
            diff = dateEnd - dateStart;
            console.log('took ' + diff / 1000 + ' milli seconds');
            var json = JSON.parse(replies);
            logger.info('key found, returning redis value');
            res.send(json); 
         });
      }
      else if (replies === 0) {
         dateStart =  new Date().getUTCMilliseconds()
         parse.getObjects('Spot', queryParams, function(err, response, body, success) {      
         //console.log('spots  found:\n', body);    
         client.set(redisKey, JSON.stringify(body), function(err, replies) {
            
            dateEnd = new Date().getUTCMilliseconds();
            diff = dateEnd - dateStart;
            //console.log('key set, check redis! reply: ' + replies);
            console.log('took ' + diff / 1000 + ' seconds');
            client.expire(redisKey, redisExpireTime, function (err, replies) {
               console.log('expire set for ' + redisKey + ' to ' + redisExpireTime + ' seconds.');
            });
            
         });  
         res.send(body);
      
      });
      }
   });
   
   
});

server.get('/spot/:id', function(req, res) {
   res.send('get spot id API: ' + req.params.id);
});

 
/*
   Example Spot POST:
   {
   "lat":24.0499,
   "lon":-109.9880,
   "name":"Test",
   "description": "Delete me",	
   "wind_directions": ["N", "NE", "E", "SE"]
   }
*/
server.post('/spot', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var data = "";
   req.on('data', function(chunk) {
      data += chunk;
   });
   
   req.on('end', function() {
      //console.log('dater: ' + data);
      var json, valid;
      try {
      json = JSON.parse(data);
      } catch (err) {
         console.log('Error parsing data: ' + err);
         res.statusCode = 400;
         res.send(err);
         return;
      } 
      valid = validate(json, spotSchema);
      if (valid.length > 0 ) {
         console.log('Error validating spot schema:\n', valid);
         res.statusCode = 400;
         res.send('Error validating spot schema:\n' + JSON.stringify(valid));
         return;
      }
      else if (json.lat > 90 || json.lat < -90  || json.lon < -180 || json.lon > 180){
         res.statusCode = 400;
         res.send("Invalid lat/long format");
         return;
      }
      else {
         createSpot(json);
      }
      
      //console.log('all the data received: ', JSON.stringify(json));
      res.send('Spot for ' + json.name + ' created');
   });

});

server.put('/spot/:id', function(req, res){
   res.send('update spot id: ' + req.params.id);
});

server.del('/spot/:id', function(req, res) {
   var id = req.params.id;
   console.log('id: ' + id);

   parse.deleteObject("Spot", id, function(err, response, body, success){
      console.log('err: ' + err + ", body: " + body + ', success: ' + success);
      if (err) {
         logger.error('Error deleting spot: ' + err);
      }
      
   });
   res.end();
});

/**
   Function to call parse, create actual object
**/

function createSpot(spot) {
   console.log('spot to create: ' + JSON.stringify(spot));
   spot.location = {
       __type: 'GeoPoint',
       latitude: spot.lat,
       longitude: spot.lon
    };
	// remove unnecessary lat/lon since it was converted to GeoPoint
   delete spot.lat;
   delete spot.lon;
   parse.createObject("Spot", spot, function(err, res, body, success) {
     console.log('object created = ', body);
     console.log('object id = ', body.objectId);
   });
};
