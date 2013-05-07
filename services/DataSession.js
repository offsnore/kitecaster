var redis = require('redis')
  , nconf = require('nconf')
  , crypto = require('crypto')
  , winston = require('winston')
  , validate = require('jsonschema').validate
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

app.newuser = function(req, callback_method) {
	var parseApp = new ParseObject(nconf.get('parse:appId'), nconf.get('parse:restKey'));	
	var userInfo = {
		username: req.email,
		password: req.password,
		email: req.email
	};
	parseApp.createUser(userInfo, function(err, res, body, success){
		if (!err) {
			if (body.error) {
				callback_method({}, body.error);
			} else {
				var sessionToken = body.sessionToken;
				// Gets the most up-to-date Info based on DataStore Logic
				userInfo['name'] = req.firstname;
				userInfo['lastname'] = req.lastname;
				userInfo['travel_distance'] = "50"; // default
				userInfo['unit_preference'] = "kitescore";
				userInfo['UserPointer'] = {
					"__type" : "Pointer",
					"className" : "_User",
					"objectId" : body.objectId
				};
				Datastore.records.createobject("Profiles", userInfo, function(err, response, body) {
					if (body.error) {
						callback_method(body, body.error);
					} else {
						callback_method(body, {}, sessionToken);
					}
				});
			}
		}
	});
};

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

app.registerUser = function(req, res, callback_method) {
	var json = req;
	var registerSchema = {
		"id": "/CheckinSpot",
		"type": "object",
		"properties": {
			"firstname": {
				"type": "string",
				"required" : true
			},
			"lastname": {
				"type": "string",
				"required" : true
			},
			"email": {
				"type": "string",
				"required" : true
			},
			"password": {
				"type": "string",
				"required" : true
			},
			"password_confirm": {
				"type": "string",
				"required" : true
			}
		}
	};
	// two part process, 1 create the User Account, 2 create the profile
	var valid;
	valid = validate(json, registerSchema);
	if (valid.length > 0 ) {
		console.log('Error validating spot schema:\n', valid);
		res.send(500, 'Error validating spot schema:\n' + valid);
		return;
	} else {
		console.log('entry validated just fine .. pushing to object parse.com');
		//res.send("creating new user at parse.com..");
		app.newuser(json, function() {
			callback_method(arguments);
		});
	}
};

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