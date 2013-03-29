var restify = require('restify'),
    nconf = require('nconf'),
    validate = require('jsonschema').validate,
    Parse = require('kaiseki'),
    //winston = require('winston'),
    redis = require("redis"),
    colors = require('colors'),
    //jsonify = require("redis-jsonify"),
   // client = redis.createClient(),
    async = require('async'),
    logger = require('winston'),
    wundernode = require('wundernode');

var redisSpotIdKey = 'spot:id:counter';

var options = {
   colorize : "true"
};





