var restify = require('restify'),
    nconf = require('nconf'),
    validate = require('jsonschema').validate,
    Parse = require('kaiseki'),
    //winston = require('winston'),
    redis = require("redis"),
    colors = require('colors'),
    //jsonify = require("redis-jsonify"),
    client = redis.createClient();
    
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

var logger = {}; logger.info = console.log; logger.debug = console.log; logger.error = console.err;

logger.info("Started model service".debug);

nconf.argv()
       .env()
       .file({ file: '../settings.json' });
       
var DEFAULT_PORT = 8502;
var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey')); 
var restPort = DEFAULT_PORT;

var windSchema = {
   "id": "/SimpleWind",
   "type": "object"<
   "properties": {
      "description" : {"required" : false, "type" : "string"}
   }
   
}

var modelSchema = {
   "id": "/SimpleModel",
      "type":"object",
      "properties" : {
         "name" : {"type":"string", "required": false},
         "private": {"type": "boolean", "default": false},
         "units": {"type": "string", "default":"mph"},
         "low_range": {"type": "object", "required": true},
         "mid_range": {"type": "object", "required": true},
         "high_range": {"type": "object", "required": true},
         "description" : {"type":"string"},
         "keywords": {
            "type": "array",
            "items" : {"type":"string"},
            "required": false
         }
      }      
}

if (nconf.get('api:model:port'))
   restPort = nconf.get('api:model:port');
   
logger.debug('model port: ' + nconf.get('api:model:port'));

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

server.get('/model', function(req, res) {
   var queryParts = require('url').parse(req.url, true).query;
   var lat, lon, distance = 30000, limit = 10, queryParams = {}, distanceFormat;
   var redisKey = "spot:search:", redisExpireTime = nconf.get('redis:expireTime') * 1000, redisExpire = true;
   res.send('/model called!');
   
});




       