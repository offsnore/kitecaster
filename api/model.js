var restify = require('restify'),
    nconf = require('nconf'),
    validate = require('jsonschema').validate,
    Validator = require('../node_modules/jsonschema/lib/validator'),
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
var redisModelIdKey = "model:id:counter";
logger.info("Started model service".debug);

nconf.argv()
       .env()
       .file({ file: require('path').resolve(__dirname, '../settings.json') });

var redisExpireTime = parseInt(nconf.get('redis:expireTime'))       
var DEFAULT_PORT = 8502;

var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey')); 
var restPort = nconf.get('api:model:port');
if ( !restPort ) {
   restPort = DEFAULT_PORT;
}
console.log('nconf port: '.magenta + nconf.get('api:model:port'));
console.log('parse appid: '.magenta + nconf.get('parse:appId'));
logger.info('Starting model api on port: ' + restPort);

var windSchema = {
   "id": "/SimpleWind",
   "type": "object",
   "properties": {
      "name" : {"required" : false, "type" : "string"},
      "description" : {"required" : false, "type" : "string"},
      "min" : {"type" : "number", "required" : true, "minimum" : 0, "maximum" : 100},
      "max" : {"type" : "number", "required" : true, "minimum" : 0, "maximum" : 100},
   }
   
}

var modelSchema = {
   "id": "/SimpleModel",
      type:"object",
      properties : {
          userId : { type: "number", required : false},
         name :  { type : "string", "required": true},
         private: {type: "boolean", "default": false},
         units: {type: "string", "default":"mph"},
         wind_low : { type : "object", "required":  true, "$ref" : "/SimpleWind" },
         wind_med : {  type : "object", "required":  true, "$ref" : "/SimpleWind" },
         wind_high : { type : "object", "required": true, "$ref" : "/SimpleWind" },
         description : {"type":"string"},
         keywords: {
            type: "array",
            items : {"type":"string"},
            required: false
         }
      }      
}

var v = new Validator();
v.addSchema(windSchema, '/SimpleWind');
v.addSchema(modelSchema, '/SimpleModel');


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
   getModel(1, res);   
});


// Retrieve specific modelId

server.get('/model/:id', function(req, res) {
   //res.send('get model id API: ' + req.params.id);
   var id = parseInt(req.params.id);
   logger.debug('Getting model ID:', req.params.id);
   getModel(id, res);
    
});

/*
   Example model POST:
   {
      "user" : "default",
      "name":"Standard Model",
      "description": "Delete me",	
   	"wind_low" : {"min": 8, "max": 15},	
   	"wind_med" : {"min": 16, "max": 25},	
   	"wind_high" : {"min": 26, "max": 35}
   }
*/
server.post('/model', function(req, res) {
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
     var valid = v.validate(json, modelSchema);
      if (valid.length > 0 ) {
         console.log('Error validating model schema:\n', valid);
         res.statusCode = 400;
         res.send('Error validating model schema:\n' + JSON.stringify(valid));
         return;
      }
      else {
         createModel(json, res);
         //res.send('RESPONSE: ' + JSON.stringify(modelResp));
      }
      
      //console.log('all the data received: ', JSON.stringify(json));
      //res.send('Model for ' + json.name + ' created');
   });

});

server.put('/model/:id', function(req, res){
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
      
      valid = validate(json, modelSchema);
      if (valid.length > 0 ) {
         console.log('Error validating model schema:\n', valid);
         res.statusCode = 400;
         res.send('Error validating model schema:\n' + JSON.stringify(valid));
         return;
      }
      else if (json.lat > 90 || json.lat < -90  || json.lon < -180 || json.lon > 180){
         res.statusCode = 400;
         res.send("Invalid lat/long format");
         return;
      }
      else {   
         updatemodel(json);
      }
      
      //console.log('all the data received: ', JSON.stringify(json));
      res.send('model for ' + json.name + ' created');
   });
});

server.del('/model/:id', function(req, res) {
   var id = req.params.id;
   console.log('id: ' + id);
    var queryParams = {
            where: {modelId : parseInt(req.params.id)   },
         };
    parse.getObjects('Model', queryParams , function(err, response, body, success) {
            console.log('found object = ', body, 'success: ' , success);
            var bodyJson = JSON.parse(JSON.stringify(body));
            if (body.length == 0) {
               res.send(404, "model " + req.params.id + " doesn't exist");
               return;
            }
            var model = bodyJson[0];            
            var modelParseId = model.objectId;
            logger.info('modelParseId to delete: '.red + modelParseId );
            parse.deleteObject("Model", modelParseId, function(err, response, body, success){
               console.log( "body: " + JSON.stringify(body) + ', success: ' + success);
               if (err) {
                  res.sendError('Error deleting model: ' + err);
               }
               else if (success === true) {
                  res.send('model ' + id + ' successfully deleted');
                  return;
               }
            });
         });      
   

    
});

function createModel(model, res){
   logger.info('creating model\n'.green + JSON.stringify(model));
   console.log('model to create: ' + JSON.stringify(model)); 
	// remove unnecessary lat/lon since it was converted to GeoPoint
      // 1. increment and get model ID for lookup
   // 2. Save the model
   if ( !model.wind_low || !model.wind_med  || !model.wind_high ) {
      res.send(400, "Missing required wind data configuration");
      return;
   }
   var modelId; 
   var response;
   
   client.incr(redisModelIdKey, function(err, replies) {
      modelId = replies; 
      model.modelId = modelId;  
      logger.info('model: '.red + JSON.stringify(model));
      parse.createObject("Model", model, function(err, res2, body, success) {
         logger.info('created model: ' + JSON.stringify(body));
         res.send(body);
      });
   });
  

}

function getModel (id, res) {
   var redisKey = 'model:id:' + id;
   client.exists(redisKey , function (err, reply){
      if (reply === 1){
         client.get(redisKey, function (err, replies) {
            logger.debug('redisKey found for ' + redisKey + ': ' + replies);
            res.send(JSON.parse(replies));
         });
      }
      else if (reply === 0) {
         var queryParams = {
            where: {modelId : parseInt(id)   },
         };
         logger.debug('queryParams: ' + JSON.stringify(queryParams));
         parse.getObjects('Model', queryParams , function(err, response, body, success) {
            console.log('found object = ', body, 'success: ' , success);
            
            var bodyJson = JSON.parse(JSON.stringify(body));
            if (body.length == 0) {
               res.send(404, "model " + id + " doesn't exist");
            }
            else {
               client.set(redisKey,  JSON.stringify(bodyJson[0]), function (err, response, body, success) {
                  client.expire(redisKey, redisExpireTime, function (err, replies) {
                     console.log('expire set for ' + redisKey + ' to ' + redisExpireTime + ' seconds.');
                  });
   
               });
               res.send(bodyJson[0]);
            }
            
         });
      }
   });
}

function addToRedisKey(key, array) {
   var retString = key;
   array.forEach(function(item)
   {
      retString += item + ":";
   });
   return retString; 
}

/**
   Function to call parse, update existing model object
**/
function updateModel(model) {
    if (!model.objectId) {
       throw new Error("No ID in object");
    }
   console.log('model to create: ' + JSON.stringify(model));
   // remove Parse internal readonly fields before sending
   /*
delete model.objectId;
   delete model.createdAt;
   delete model.updatedAt;
   
*/
   parse.updateObject("Model", model.objectId, model, function(err, res, body, success) {
      console.log('object created = ', body);
      var redisKey = 'model:id:' + model.modelId;
      client.del(redisKey, function(error, reply) {
         logger.debug('stale key deleted: ' + redisKey);
      });
   });
};





       