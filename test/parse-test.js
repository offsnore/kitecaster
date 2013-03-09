var restify = require('restify'),
    nconf = require('nconf'),
    validate = require('jsonschema').validate,
    Parse = require('kaiseki'),
    //winston = require('winston'),
    redis = require("redis"),
    colors = require('colors'),
    //jsonify = require("redis-jsonify"),
    client = redis.createClient();
    


nconf.argv()
       .env()
       .file({ file: '../settings.json' }); 
       
console.log('parse:appId- ' + nconf.get('parse:appId'));
console.log('parse:restKey- ' + nconf.get('parse:restKey'));
var parse = new Parse( nconf.get('parse:appId'),  nconf.get('parse:restKey'));   

var queryParams = {
   count: true,
   where: {spotId : 1,
         spotId: 2   }
};

parse.getObjects('Spot', queryParams, function(err, response, body, success) {      
  console.log(body);

});
