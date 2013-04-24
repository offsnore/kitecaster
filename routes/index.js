
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
		req.headers['x-forwarded-for'] = nconf.get('site:fakeip');
	}
	var geo_location = lookup.geolookup.getCurrent(req);
	var session_id = nconf.get('site:fakedSession');
	var parseApp = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));
	var profile_data = {};

	// Gets the most up-to-date Info based on DataStore Logic
	Datastore.records.getCurrent("Profiles", {"session_id": session_id}, function(data){
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
};

// Spots Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.mainSpot = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['x-forwarded-for'] = nconf.get('site:fakeip');
	}
	var geo_location = lookup.geolookup.getCurrent(req);

	// get Session Details
	var session_id = nconf.get('site:fakedSession');

	// @todo - make this use the API

/*
	Datastore.records.getCurrent("Spots", "*", function(records){
		if (records.results) {
			var records = records.results;
		}
**/
	var params = {
		spot_url: nconf.get('api:spot:frontend_url'),
		page: {
			active: 'Spots',
		},
		title: nconf.get('site:frontend:title'),
		credits: "testing",
		data: {
			spot_list: {}
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

//	});
};

// Spots Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.newSpot = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['x-forwarded-for'] = nconf.get('site:fakeip');
	}
	var geo_location = lookup.geolookup.getCurrent(req);

	var params = {
		spot_id: 0,
		spot_url: nconf.get('api:spot:frontend_url'),
		google_api_key: 'AIzaSyDBD7vGX-y9pO8PP8bHCOQlKztjWzcJNf8',
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
	    geo: function(){
			var g = geo_location;
	    	var lat = g.ll[0];
	    	var lon = g.ll[1];
			return {
				lat: lat,
				lon: lon
			}
	    },
	    location: function() {
	    	return geo_location;
	    },
	    data: {}
	}	
	res.render('newspot', params);
};

/**
 * editSpot()
 * Spots Page for Application
 * @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
 */
exports.editSpot = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['x-forwarded-for'] = nconf.get('site:fakeip');
	}
	var geo_location = lookup.geolookup.getCurrent(req);
	var objectId = req.params[0];
	if (objectId == '') {
		errorPage(res, "We were unable to locate this spot (missing ID).");
	}
	var params = {
		spot_id: objectId,
		spot_url: nconf.get('api:spot:frontend_url'),
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
		data: {
			records: {}
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
	res.render('editspot', params);

//	Datastore.records.find("Spots", objectId, function(records){
//		res.render('newspot', params);
//	});
};

/**
 * editSpotSave()
 * @param req
 * @param res
 */
exports.editSpotSave = function(req, res) {

	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['x-forwarded-for'] = nconf.get('site:fakeip');
	}
	var objectId = req.params[0];
	if (objectId == '') {
		errorPage(res, "We were unable to locate this spot (missing ID).");
	}
	// get Session Details
	var session_id = nconf.get('site:fakedSession');
	// @todo Include images in 'update'
	Datastore.records.save("Spots", objectId, req.body, function(){
		// nothing to report, it just wroks .. hrmm maybe invalidate the record?
	});
	res.redirect('/main/spots');	
};

/**
 * newSpotSave()
 * @param req
 * @param res
 */
exports.newSpotSave = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['x-forwarded-for'] = nconf.get('site:fakeip');
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
	    },
	    data: {
		    
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

	// Fake SessionID	
	var data = {};
	data = req.body;
	data['sesson_id'] = session_id;
	
	Datastore.records.create("Spots", data, function(err, data){
		params.body['status'] = "You have successfully added this spot!";
		res.render("newspot", params);
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

/**
 * mainProfileSave()
 * @param req
 * @param res
 */
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
 * errorPage
 * General catch-all for error message pages
 */
function errorPage(res, message) {
	res.render('error', {
			'title': 'An unexpected error has occured.', 
			'message' : (message ? message : 'An unexpected error has occured.'),
			'page' : { 
				'active':'error'
			} 
		});
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
