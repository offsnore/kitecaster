
/**
 * Do a general pull for Global Site Configs
 */
var 
	fs = require('fs')
  , nconf = require('nconf')
  , winston = require('winston')
  , Parse = require('parse-api').Parse
  , moment = require('moment')
  , lookup = require('../services/UserGeoIP')
  , Datastore = require('../services/DataStore');

function getSettings() {
	nconf.argv()
	       .env()
	       .file({ file:'settings.json' });
    return nconf;
}

/*
 * GET mappings to views
 * Remember to keep this in alpabetic order (for comprehension's sake)
 */

exports.email = function(req, res){
   console.log('foobar');
};

exports.example = function(req, res){
  res.render('example', { title: 'Exampe Full Bootstrap page' });
};

exports.index = function(req, res){
  res.render('index', { title: 'Kitecaster' });
};

exports.spot = function(req, res) {
   console.log('spot api called'); 
   res.send('spot API called');
};

exports.start = function(req, res) {
   console.log('start url called'); 
   res.render('start', { title: 'kitecaster - beta', body: 'You ready for this?', scripts: ['js/lib/jquery.js', 'js/lib/underscore.js'] });
};

exports.test = function(req, res){
  res.render('test', { title: 'Test Page Demos' });
};

// First Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.mainIndex = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['X-Forwarded-For'] = nconf.get('site:fakeip');
	}
	var geo_location = lookup.geolookup.getCurrent(req);
	var session_id = nconf.get('site:fakedSession');
	var parseApp = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));
	var profile_data = {};

	// Gets the most up-to-date Info based on DataStore Logic
	Datastore.records.getCurrent("Profiles", {"session_id": session_id}, function(data){
//		if (data.length > 0) {
//			var profile_data = response.results[0];
//		}
		var params = {
			page: {
				active: 'Home',
			},
			title: nconf.get('site:frontend:title'),
			credits: "testing",
			body: {
				content: {
					pageinfo: "first entry into page",
				},
				widgets: [
					{
						name: "feed",
						header: "feed info",
						content: ""
					}
				]
			},
			data: {
				profile_data: profile_data			
			},
		    dateNow: function(date) {
			    if (date) {
				    var dateValue = new Date(date);
				    return moment(dateValue).fromNow();
			    }
		        var dateNow = new Date();
		        var dd = dateNow.getDate();
		        var monthSingleDigit = dateNow.getMonth() + 1,
		            mm = monthSingleDigit < 10 ? '0' + monthSingleDigit : monthSingleDigit;
		        var yy = dateNow.getFullYear().toString().substr(2);
		        return (mm + '/' + dd + '/' + yy);
		    },
		    location: function() {
		    	return geo_location;
		    }
		}
		res.render('main', params);
	});

/**
	console.log(Datastore.records);
		
//	records.getCurrent({"session_id": session_id}, "Profiles");
//	console.log(records);
		
	parseApp.find('Profiles', {'session_id': session_id}, function (err, response) {
		if (response.results.length > 0) {
			var profile_data = response.results[0];
		}
		var params = {
			page: {
				active: 'Home',
			},
			title: nconf.get('site:frontend:title'),
			credits: "testing",
			body: {
				content: {
					pageinfo: "first entry into page",
				},
				widgets: [
					{
						name: "feed",
						header: "feed info",
						content: ""
					}
				]
			},
			data: {
				profile_data: profile_data			
			},
		    dateNow: function(date) {
			    if (date) {
				    var dateValue = new Date(date);
				    return moment(dateValue).fromNow();
			    }
		        var dateNow = new Date();
		        var dd = dateNow.getDate();
		        var monthSingleDigit = dateNow.getMonth() + 1,
		            mm = monthSingleDigit < 10 ? '0' + monthSingleDigit : monthSingleDigit;
		        var yy = dateNow.getFullYear().toString().substr(2);
		        return (mm + '/' + dd + '/' + yy);
		    },
		    location: function() {
		    	return geo_location;
		    }
		}
		res.render('main', params);
	});
**/
};

// Spots Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.mainSpot = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['X-Forwarded-For'] = nconf.get('site:fakeip');
	}
	var geo_location = lookup.geolookup.getCurrent(req);

	// get Session Details
	var session_id = nconf.get('site:fakedSession');

	Datastore.records.getCurrent("Spots", "*", function(records){
		if (records.results) {
			var records = records.results;
		}
		var params = {
			page: {
				active: 'Spots',
			},
			title: nconf.get('site:frontend:title'),
			credits: "testing",
			data: {
				spot_list: records
			},
			body: {
				content: {
					pageinfo: "first entry into spots page"
				},
				widgets: []
			},
		    dateNow: function() {
		        var dateNow = new Date();
		        var dd = dateNow.getDate();
		        var monthSingleDigit = dateNow.getMonth() + 1,
		            mm = monthSingleDigit < 10 ? '0' + monthSingleDigit : monthSingleDigit;
		        var yy = dateNow.getFullYear().toString().substr(2);
		
		        return (mm + '/' + dd + '/' + yy);
		    },
		    location: function() {
		    	return geo_location;
		    }
		}
		res.render('spot', params);
	});
};

// Spots Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.newSpot = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['X-Forwarded-For'] = nconf.get('site:fakeip');
	}
	var geo_location = lookup.geolookup.getCurrent(req);

	var params = {
		page: {
			active: 'Spots',
		},
		title: nconf.get('site:frontend:title'),
		credits: "testing",
		body: {
			content: {
				pageinfo: "first entry into spots page"
			},
			widgets: []
		},
	    dateNow: function() {
	        var dateNow = new Date();
	        var dd = dateNow.getDate();
	        var monthSingleDigit = dateNow.getMonth() + 1,
	            mm = monthSingleDigit < 10 ? '0' + monthSingleDigit : monthSingleDigit;
	        var yy = dateNow.getFullYear().toString().substr(2);
	
	        return (mm + '/' + dd + '/' + yy);
	    },
	    location: function() {
	    	return geo_location;
	    }
	}
	res.render('newspot', params);
};

exports.newSpotSave = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['X-Forwarded-For'] = nconf.get('site:fakeip');
	}

	// get Session Details
	var session_id = nconf.get('site:fakedSession');

	var geo_location = lookup.geolookup.getCurrent(req);
	var params = {
		page: {
			active: 'Spots',
		},
		title: nconf.get('site:frontend:title'),
		credits: "testing",
		body: {
			content: {
				pageinfo: "first entry into spots page"
			},
			widgets: []
		},
	    dateNow: function() {
	        var dateNow = new Date();
	        var dd = dateNow.getDate();
	        var monthSingleDigit = dateNow.getMonth() + 1,
	            mm = monthSingleDigit < 10 ? '0' + monthSingleDigit : monthSingleDigit;
	        var yy = dateNow.getFullYear().toString().substr(2);
	
	        return (mm + '/' + dd + '/' + yy);
	    },
	    location: function() {
	    	return geo_location;
	    }
	}

	if (req.files.spot_image.path) {
		fs.readFile(req.files.spot_image.path, function (err, data) {
			var newPath = __dirname + "/../public/media/" + req.files.spot_image.name;
			fs.writeFile(newPath, data, function (err) {
				if (err) {
					console.log("shit, didn't write file to path.", err);
				}
		    });
		});
	}
	
	Datastore.records.save("Spots", {"session_id": session_id}, req.body, function(err, data){
		res.render('newspot', params);
	});
}


// Profile Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.mainProfile = function(req, res) {

	// get Session Details
	var session_id = nconf.get('site:fakedSession');
	var parseApp = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));
	var profile_data = {};
	parseApp.find('Profiles', {'session_id': session_id}, function (err, response) {
		if (response.results.length > 0) {
			var profile_data = response.results[0];
		}
		var params = {
			page: {
				active: 'Profile',
			},
			data: {
				profile_data: profile_data			
			},
			title: nconf.get('site:frontend:title'),
			credits: "testing",
			body: {
				content: {
					pageinfo: "Please fill out your profile",
				},
				widgets: []
			}
		}
		res.render('profile', params);
	});
};

exports.mainProfileSave = function(req, res) {
	// add submit to Parse()
	// add validation model
	var parseApp = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));
	var data = req.body;

	var logger = new (winston.Logger)({
	    transports: [
			new winston.transports.Console({timestamp:true})
			//new winston.transports.File({ timestamp:true, filename: '/var/logs/kitecaster/server.log' })
	    ],
	    exceptionHandlers: [
            new winston.transports.Console({timestamp:true})
			//new winston.transports.File({ timestamp:true, filename: '/var/logs/kitecaster/server-exceptions.log' })
	    ] 
	  });

	var session_id = nconf.get('site:fakedSession');
	data['session_id'] = session_id;

	// @todo Add data validation
	// @todo Add err handling on err from Host
	try {
		parseApp.find('Profiles', {'session_id': session_id}, function (err, response) {
			if (response.results.length > 0) {
				var id = response.results[0].objectId;
				parseApp.update('Profiles', id, data, function (err, response) {
					logger.debug("update result");
					logger.debug(err);
					logger.debug(JSON.stringify(response));
					mainProfileSaveAfter(parseApp, res, session_id, data, response);
				});
			} else {
				parseApp.insert('Profiles', data, function(err, response) {
					logger.debug("insert result");
					logger.debug(err);
					logger.debug(JSON.stringify(response));
					mainProfileSaveAfter(parseApp, res, session_id, data, response);	
				});			
			}
		});
	} catch (e) {
		logger.debug(e);
	}
}

/**
 * mainProfileSaveAfter
 * @usage Acts as a private method to be called after an update/insert is performed
 * @param Object parseApp
 * @param Object res
 * @param Object data
 * @param Object response
 */
function mainProfileSaveAfter(parseApp, res, session_id, data, response) {
	var profile_data = {};
	parseApp.find('Profiles', {'session_id': session_id}, function (err, response) {
		if (response.results.length > 0) {
			var profile_data = response.results[0];
		}
		var params = {
			page: {
				active: 'Profile',
			},
			data: {
				profile_data: profile_data			
			},
			title: nconf.get('site:frontend:title'),
			credits: "testing",
			body: {
				status: "Successfully added this information.",
				content: {
					pageinfo: "Please fill out your profile",
				},
				widgets: []
			}
		}
		res.render('profile', params);
	});
}
