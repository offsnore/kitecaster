var redis = require('redis')
  , nconf = require('nconf')
  , crypto = require('crypto')
  , winston = require('winston')
  , ParseObject = require('kaiseki')
  , connect = require('connect')
  , Parse = require('parse-api').Parse;

var app = module.exports = {};

app.login = function(q, callback) {
	var parseApp = new ParseObject(nconf.get('parse:appId'), nconf.get('parse:restKey'));

	parseApp.loginUser(q.username, q.password, function(err, res, body, success){
		if (!err) {
			callback(body);
		}
	});
	
}

app.setlogincookie = function(res, obj) {
	res.cookie(nconf.get('session:cookiename'), JSON.stringify(obj), { maxAge: 9000000, httpOnly: true});
}

app.logout = function(res, callback) {
	res.cookie(nconf.get('session:cookiename'), {}, { maxAge: -1000 });
	callback(res);
}