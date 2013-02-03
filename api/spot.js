var restify = require('restify'),
    nconf = require('nconf'),
    validate = require('jsonschema').validate,
    Parse = require('kaiseki'),
    winston = require('winston');
    
var logger = new (winston.Logger)({
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: '../logs/spot.log' })
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: '../logs/spot-exceptions.log' })
    ]
  });

nconf.argv()
       .env()
       .file({ file: '../settings.json' });   
   
var DEFAULT_PORT = 8080;

var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey')); 

/*parse.getUsers(function(err, res, body, success) {
  console.log('all users = ', body);
});
*/   


/* Parse Setup */
//var Parse = require('parse-api').Parse;
//var app = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));

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


//DELETE THIS
function respond(req, res, next) {
  res.send('hello ' + req.params.name);
}

var server = restify.createServer();
server.get('/hello/:name', respond);
server.head('/hello/:name', respond);

//-----

server.listen(restPort, function() {
  console.log('%s listening at %s', server.name, server.url);
});

/**
   SPOT API
**/

server.get('/spot', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon, distance = 30000, limit = 10, queryParams = {}, distanceFormat;

   if (queryParts.geoloc) {
      logger.debug('geoloc: ' + queryParts.geoloc);
      lat = queryParts.geoloc.split(/,/)[0];
      lon = queryParts.geoloc.split(/,/)[1];
   }
   else if (queryParts.lat && queryParts.lon) {
      lat = Number(queryParts.lat);
      lon = Number(queryParts.lon);
   }
   
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
   }
   
   else if (queryParts.description) {
      queryParams.where = {
         description: queryParts.description
      }
   }
   else if (queryParts.keywords) {
      var mode = 'compound';
      if (queryParts.mode && (queryParts.mode === "compound" || queryParts.mode === "filter")){
         mode = queryParts.mode;
      } 
         
      var arr = queryParts.keywords.split(/,/);
      if (mode === "compound") {
         var params = "{\"where\":{ \"$or\":[";
         arr.forEach(function(item){
            console.log('item: ' + item);
            params += "{\"keywords\":\"" + item + "\"},"
         });
         // remove trailing comma
         params = params.substring(0, params.length-1);
         params += "]}}"; // close out the json object
      }
      else if (mode === "filter") {
         var params = "{\"where\":{";
         arr.forEach(function(item){
            console.log('item: ' + item);
            params += "\"keywords\":\"" + item + "\","
         });
         // remove trailing comma
         params = params.substring(0, params.length-1);
         params += "}}"; // close out the json object
      }
      console.log('params: ' + params);
      var json = JSON.parse(params);
      console.log('jsonified: ' + JSON.stringify(json));
      queryParams = json;
      logger.debug('keywords params: ' + JSON.stringify(queryParams));
      
   }
   else if (lat && lon) {   
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
   var resp;
   parse.getObjects('Spot', queryParams, function(err, response, body, success) {      
      console.log('spots  found:\n', body);
      res.send(body);
   
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
