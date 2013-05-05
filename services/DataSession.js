var redis = require('redis')
  , nconf = require('nconf')
  , crypto = require('crypto')
  , winston = require('winston')
  , ParseObject = require('kaiseki')
  , connect = require('connect')
  , Datastore = require('./DataStore')
  , sleep = require('sleep')
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

app.getuser = function(req, callback_method) {
	var session = app.getsession(req);
	var parseApp = new ParseObject(nconf.get('parse:appId'), nconf.get('parse:restKey'));	
	parseApp.getUser(session.objectId, function(err, res, body, success){
		if (!err) {
			// Gets the most up-to-date Info based on DataStore Logic
			var q = {};
			q['include'] = "UserPointer";
			q['where'] = {"UserPointer":{"__type":"Pointer","className":"_User","objectId": body.objectId}};
			Datastore.records.object("Profiles", q, function(err, response, body) {
				callback_method(err, response, body);
			});
		}
	});
}

app.setlogincookie = function(res, obj) {
	res.cookie(nconf.get('session:cookiename'), JSON.stringify(obj), { maxAge: 9000000, httpOnly: true});
}

app.logout = function(res, callback) {
	res.clearCookie(nconf.get('session:cookiename'));
	//res.cookie(nconf.get('session:cookiename'), {}, { maxAge: -1000 });
	callback(res);
}

app.getsession = function(req) {
	var sess = req.cookies[nconf.get('session:cookiename')];
	if (sess) {
		return JSON.parse(sess);
	} else {
		return {};
	}
}