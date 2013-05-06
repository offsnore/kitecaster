
var   redis = require("redis"),
      client = redis.createClient(),
      logger = require('winston'),
      nconf = require('nconf'),
      Parse = require('kaiseki')
;
var ModelService = {};
nconf.argv()
	       .env()
	       .file({ file: require('path').resolve(__dirname, '../settings.json') });


var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey')); 
var client = redis.createClient();
var redisExpireTime = 600;//parseInt(nconf.get('redis:expireTime'));

ModelService.createModel = function(model, callback){
   console.log('creating model\n'.green + JSON.stringify(model));
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
      console.log('model: '.red + JSON.stringify(model));
      parse.createObject("Model", model, function(err, res2, body, success) {
         console.log('created model: ' + JSON.stringify(body));
         callback(body);
      });
   });
  

};


ModelService.getModel = function(id, callback) {
   var redisKey = 'model:id:' + id;
   client.exists(redisKey , function (err, reply){
      if (reply === 1){
         client.get(redisKey, function (err, replies) {
            console.log('redisKey found for ' + redisKey + ': ' + replies);
            callback(null, replies);
         });
      }
      else if (reply === 0) {
         var queryParams = {
            where: {modelId : parseInt(id)   },
         };
         console.log('queryParams: ' + JSON.stringify(queryParams));
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
               callback(null, bodyJson);
            }
            
         });
      }
   });
};

module.exports = ModelService;


