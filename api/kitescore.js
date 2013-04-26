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
    kiteScoreService = require('../services/KiteScoreService');
    
var options = {
   colorize : "true"
};


nconf.argv()
       .env()
       .file({ file: '../settings.json' }); 
       
var wundegroundAPI = nconf.get('weather:apis:wunderground');
console.log('wunderground key: '.red + wundegroundAPI); 

var wunder = new wundernode(wundegroundAPI, true);


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

var DEFAULT_PORT = 7503;
var restPort;
if (nconf.get('api:kitescore:port'))
   restPort = nconf.get('api:kitescore:port');
else restPort = DEFAULT_PORT;
console.log('restport: ' + restPort);

server.listen(restPort, function() {
  console.log('%s listening at %s'.blue, server.name, server.url);
});

process.argv.forEach(function (val, index, array) {
  if (val === '-p')
   {
      restPort = array[index+1] || DEFAULT_PORT;
   }
}); 

server.get('forecast/api', function(req, res) {
    res.send(api);
});

server.get('forecast/today', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon, query, spotId, modelId;
   console.log("queryparts: " + JSON.stringify(queryParts));   
   
   var queryParams = {
         //limit : limit,
         count: true        
         };


   // location parameters
   if (queryParts.geoloc) {
      logger.debug('geoloc: '.red + queryParts.geoloc);
      lat = Number(queryParts.geoloc.split(/,/)[0]);
      lon = Number(queryParts.geoloc.split(/,/)[1]);
   }
   else if (queryParts.lat && queryParts.lon) {
      lat = Number(queryParts.lat);
      lon = Number(queryParts.lon);
   }
   else if (queryParts.spotId) {
      spotId = queryParts.spotId;   
   }
   
   // modeId check
   if (queryParts.modelId) {
      modelId = queryParts.modelId;
   }
   
   
   
   
   
   
   if ( (!spotId || (!lat && !lon)) || !queryParts.query ) {
      res.send(400, "Bad request, must specify location or spot");
      return;
   }
   
   if (queryParts.query) {
      // first query for location
      console.log('querying forecast for query location: ' + queryParts.query);
      wunder.geolookup(function(err, obj) {
               res.end(obj);
       }, queryParts.query);
      
   }
   
   
      

});

server.get('forecast/tomorrow', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon;
});

server.get('forecast/7day', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon;
});

server.get('forecast/10day', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon;
});






