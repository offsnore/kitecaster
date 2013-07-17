
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
  , Datastore = require('../services/DataStore')
  , Datasession = require('../services/DataSession');

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

exports.registerIndex = function(req, res) {
	var queryParams = require('url').parse(req.url, true).query
	var params = {
		txt: false,
		msg: false,
		title: ""
	};
	if (queryParams.msg) {
		params.msg = queryParams.msg;
	}
	if (queryParams.txt) {
		params.txt = queryParams.txt;
	}
	res.render('register', params);
};

exports.registerAction = function(req, res) {
	var nconf = getSettings();
	var data = req.body;
	var org_data = data;

	var error, response, session_token;

	// We standardize Email Addyz
	data.email = (data.email).toString().toLowerCase();

	Datasession.registerUser(data, res, function(){
		var _args = arguments;
		if (_args) {
			var _params = _args[0];
		}
		if (typeof _params[0] != 'undefined') {
			var response = _params[0];
		}
		if (typeof _params[1] != 'undefined') {
			var error = _params[1];
		}
		if (typeof _params[2] != 'undefined') {
			var session_token = _params[2];
		}
		if (error.length > 0) {
			res.redirect('/main/register?msg=' + encodeURIComponent(error));			
		} else {
			var q = {
				username: org_data.email,
				password: org_data.password
			};
			Datasession.login(q, function(data){
				if (data.sessionToken) {
					data.timestamp = new Date();
					Datasession.setlogincookie(res, data);
					res.redirect('/main?first_login=true');
				} else {
					res.redirect('/main/login?msg=' + encodeURIComponent(data.error));			
				}
			});
		}
	});
}

exports.loginIndex = function(req, res) {
	var queryParams = require('url').parse(req.url, true).query
	var params = {
		txt: false,
		msg: false,
		title: ""
	};
	if (queryParams.msg) {
		params.msg = queryParams.msg;
	}
	if (queryParams.txt) {
		params.txt = queryParams.txt;
	}
	res.render('login', params);
}

exports.loginAction = function(req, res) {
	var nconf = getSettings();
	var data = req.body;
	var q = {
		username: (data.email).toLowerCase(),
		password: data.password
	};
	Datasession.login(q, function(data){
		if (data.sessionToken) {
			data.timestamp = new Date();
			Datasession.setlogincookie(res, data);
			res.redirect('/main?first_login=true');
		} else {
			res.redirect('/main/login?msg=' + encodeURIComponent(data.error));			
		}
	});
}

exports.logoutIndex = function(req, res) {
	Datasession.logout(res, function(res){
		res.redirect("/main/login?txt=" + encodeURIComponent("You have successfully logged out."));
	});
}

// First Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.mainIndex = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['x-forwarded-for'] = nconf.get('site:fakeip');
	}
	var geo_location = lookup.geolookup.getCurrent(req);
	var profile_data = {};
	var session_id;
	
	var queryParams = require('url').parse(req.url, true).query

	var first_login = false;

	if (queryParams.first_login) {
    	first_login = true;
	}

	// this is how we get User Data ..
	Datasession.getuser(req, function(err, response, body){		
		if (body.length == 0) {
			return kickOut(res, "Please login again, it seems your session has expired.");
		}

		var profile_image;
		var localdata = body[0];
		
		var user_id = localdata.objectId;
		var session_id = localdata.UserPointer.objectId;
				
		if (!localdata.profile_image) {
    		localdata.profile_image = nconf.get('site:default:image');
		}

		var params = {
			first_login: first_login,
			user_id: user_id,
			session_id: session_id,
			profile_image: localdata.profile_image,
			userdata: localdata,
			spot_url: nconf.get('api:spot:frontend_url'),
			kite_url: nconf.get('api:kite:frontend_url'),
			google_api_key: nconf.get('api:google:api_key'),
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
		};
		res.render('main', params);
	});
	
//	// get Session Details
//	var session_id = nconf.get('site:fakedSession');
//	var user_id = session_id;

//	var parseApp = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));

	// Gets the most up-to-date Info based on DataStore Logic
//	Datastore.records.getCurrent("Profiles", {"session_id": session_id}, function(data){
//	});
};

/**
 * Discover Spots Relative To Local Geo
 */
exports.discoverSpot = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['x-forwarded-for'] = nconf.get('site:fakeip');
	}
	var geo_location = lookup.geolookup.getCurrent(req);
	var profile_data = {};
	var session_id;

	// this is how we get User Data ..
	Datasession.getuser(req, function(err, response, body){		
		if (body.length == 0) {
			return kickOut(res, "Please login again, it seems your session has expired.");
		}
		var localdata = body[0];
		var user_id = localdata.objectId;
		var session_id = localdata.UserPointer.objectId;
		var params = {
			user_id: user_id,
			session_id: session_id,
			spot_url: nconf.get('api:spot:frontend_url'),
			kite_url: nconf.get('api:kite:frontend_url'),
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
		};
		res.render('discover', params);
	});
};

function clone(obj){
    if(obj == null || typeof(obj) != 'object')
        return obj;
    var temp = obj.constructor(); // changed
    for(var key in obj)
        temp[key] = clone(obj[key]);
    return temp;
}

function getSession() {
	
}

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
	var session_id, user_id, profile_image, localdata, params = {};

	// this is how we get User Data ..
	Datasession.getuser(req, function(err, response, body){
		if (body.length == 0) {
			return kickOut(res, "Please login again, it seems your session has expired.");
		}

		localdata = body[0];		
		user_id = localdata.objectId;
		session_id = localdata.UserPointer.objectId;
		
		if (!profile_image) {
    		profile_image = nconf.get('site:default:image');
		}
	
		params = {
            profile_image: profile_image,
            userdata: localdata,
            user_id: user_id,
            session_id: session_id,
            spot_url: nconf.get('api:spot:frontend_url'),
            google_api_key: nconf.get('api:google:api_key'),
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
	});

};

// Spots Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.newSpot = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['x-forwarded-for'] = nconf.get('site:fakeip');
	}
	
	var queryParams = require('url').parse(req.url, true).query
	
	var profile_image, geo_location, session_id, localdata, user_id, params = {};	
	geo_location = lookup.geolookup.getCurrent(req);

	// this is how we get User Data ..
	Datasession.getuser(req, function(err, response, body){
		if (body.length == 0) {
			return kickOut(res, "Please login again, it seems your session has expired.");
		}
		localdata = body[0];		
		user_id = localdata.objectId;
		session_id = localdata.UserPointer.objectId;
		if (!profile_image) {
    		profile_image = nconf.get('site:default:image');
		}
		params = {
			spot_data: queryParams,
            profile_image: profile_image,
            userdata: localdata,
			session_id: session_id,
			spot_id: 0,
			kite_url: null,
			spot_url: nconf.get('api:spot:frontend_url'),
			google_api_key: nconf.get('api:google:api_key'),
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
	});
};

/**
 * editSpot()
 * Spots Page for Application
 * @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
 */
exports.viewSpot = function(req, res) {
	var nconf = getSettings();
	// only for Dev
	if (nconf.get('site:development') !== false) {
		req.headers['x-forwarded-for'] = nconf.get('site:fakeip');
	}

	var session_id, profile_image, geo_location, localdata, user_id, session_id, params = {};

	geo_location = lookup.geolookup.getCurrent(req);

	// this is how we get User Data ..
	Datasession.getuser(req, function(err, response, body){
		if (body.length == 0) {
			return kickOut(res, "Please login again, it seems your session has expired.");
		}
		localdata = body[0];
		user_id = localdata.objectId;
		session_id = localdata.UserPointer.objectId;
		if (!localdata.profile_image) {
    		localdata.profile_image = nconf.get('site:default:image');
		}
		var objectId = req.params[0];
		if (objectId == '') {
			errorPage(res, "We were unable to locate this spot (missing ID).");
		}

		// get Session Details
//		var session_id = nconf.get('site:fakedSession');
//		var user_id = session_id;

		params = {
            profile_image: localdata.profile_image,
            userdata: localdata,
			session_id: session_id,
			user_id: user_id,
			spot_id: objectId,
			session_id: session_id,
			spot_url: nconf.get('api:spot:frontend_url'),
			google_api_key: nconf.get('api:google:api_key'),
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
		    }
		}
		res.render('viewspot', params);
	});

//	Datastore.records.find("Spots", objectId, function(records){
//		res.render('newspot', params);
//	});
};

/**
 * editSpot()
 * Spots Page for Application
 * @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
 */
exports.viewPublicSpot = function(req, res) {
	var nconf = getSettings();

	var session_id, profile_image, geo_location, localdata, user_id, session_id, params = {};

	geo_location = lookup.geolookup.getCurrent(req);

	var queryParams = require('url').parse(req.url).query
	var query = req.url.split("/");

	var myRespEx = /\d+/g.exec(query[(query.length-1)]);
	var spot_id = myRespEx[0];

	var objectId = spot_id;
	if (objectId == '') {
		errorPage(res, "We were unable to locate this spot (missing ID).");
	}

	params = {
		spot_url: nconf.get('api:spot:frontend_url'),
		spot_id: objectId,
		google_api_key: nconf.get('api:google:api_key'),
		title: nconf.get('site:frontend:title'),
	    dateNow: function() {
	        var dateNow = new Date();
	        var dd = dateNow.getDate();
	        var monthSingleDigit = dateNow.getMonth() + 1,
	            mm = monthSingleDigit < 10 ? '0' + monthSingleDigit : monthSingleDigit;
	        var yy = dateNow.getFullYear().toString().substr(2);
	
	        return (mm + '/' + dd + '/' + yy);
	    }
	}
	res.render('public-viewspot', params);

};


/**
 * editSpot()
 * Spots Page for Application
 * @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
 */
exports.viewPublicRawSpot = function(req, res) {
	var nconf = getSettings();

	var session_id, profile_image, geo_location, localdata, user_id, session_id, params = {};

	geo_location = lookup.geolookup.getCurrent(req);

	var queryParams = require('url').parse(req.url).query
	var query = req.url.split("/");

	var myRespEx = /\d+/g.exec(query[(query.length-1)]);
	var spot_id = myRespEx[0];

	var objectId = spot_id;
	if (objectId == '') {
		errorPage(res, "We were unable to locate this spot (missing ID).");
	}

	params = {
		spot_url: nconf.get('api:spot:frontend_url'),
		spot_id: objectId,
		google_api_key: nconf.get('api:google:api_key'),
		title: nconf.get('site:frontend:title'),
	    dateNow: function() {
	        var dateNow = new Date();
	        var dd = dateNow.getDate();
	        var monthSingleDigit = dateNow.getMonth() + 1,
	            mm = monthSingleDigit < 10 ? '0' + monthSingleDigit : monthSingleDigit;
	        var yy = dateNow.getFullYear().toString().substr(2);
	
	        return (mm + '/' + dd + '/' + yy);
	    }
	}
	res.render('raw-viewspot', params);

};


exports.mainSitemap = function(req, res) {
	var nconf = getSettings();
    var params = {};
    var queryParams = {};

	// Use DataStore Instead
	Datastore.records.object("Spot", queryParams, function(err, response, body, success) {
        params['data'] = body;
    	res.render('sitemap-xml', params);
	});

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

	var session_id, profile_image, geo_location, localdata, user_id, session_id, params = {};	
	
	geo_location = lookup.geolookup.getCurrent(req);
	objectId = req.params[0];
	if (objectId == '') {
		errorPage(res, "We were unable to locate this spot (missing ID).");
	}

	// this is how we get User Data ..
	Datasession.getuser(req, function(err, response, body){
		if (body.length == 0) {
			return kickOut(res, "Please login again, it seems your session has expired.");
		}
		localdata = body[0];
		user_id = localdata.objectId;
		session_id = localdata.UserPointer.objectId;
		if (!localdata.profile_image) {
    		localdata.profile_image = nconf.get('site:default:image');
		}
		var params = {
            profile_image: localdata.profile_image,
            userdata: localdata,
			user_id: user_id,
			session_id: session_id,
			spot_id: objectId,
			google_api_key: nconf.get('api:google:api_key'),
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

	});

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


// @todo Move this into an API for APP usage later
// Profile Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.mainProfile = function(req, res) {
	var session_id, profile_image;
	Datasession.getuser(req, function(err, response, body){
		if (body.length == 0) {
			return kickOut(res, "Please login again, it seems your session has expired.");
		}
		var localdata = body[0];		
		var user_id = localdata.objectId;
		var session_id = localdata.UserPointer.objectId;

		if (!localdata.profile_image) {
    		localdata.profile_image = nconf.get('site:default:image');
		}

		var query = {
			'where': {
				'UserPointer': {
					"__type": "Pointer",
					"className" : "_User",
					"objectId" : session_id
				}
			}
		};
		var profile_data = {};
		Datastore.records.object('Profiles', query, function(err, response, body, success) {
			if (body.length < 0) {
				errorPage(res, "We were unable to locate this page.");
				return false;
			}
			var profile_data = body[0];
			var params = {
				page: {
					active: 'Profile',
				},
    			spot_url: nconf.get('api:spot:frontend_url'),
    			kite_url: nconf.get('api:kite:frontend_url'),
				session_id: session_id,
				profile_image: localdata.profile_image,
				userdata: localdata,
				user_id: user_id,
				data: {
					profile_data: profile_data
				},
				distances: [
						{
							'value' : '50',
							'label' : '50 Miles'
						},
						{
							'value' : '100',
							'label' : '100 Miles'
						},
						{
							'value' : '200',
							'label' : '200 miles'
						},
						{
							'value' : '500',
							'label' : '500 Miles'
						},
						{
							'value' : '5000',
							'label' : 'Any distance'
						}
				],
				kites: [
						{
							'value' : 'small',
							'label' : 'Small Kite (5, 6, 7, 8, 9)'
						},{
							'value' : 'medium',
							'label' : 'Medium Kite (10, 11, 12)'
						},{
							'value' : 'large',
							'label' : 'Large Kite (Greater than 12'
						}
				],
				title: nconf.get('site:frontend:title'),
				credits: '',
				body: {
					content: {
						pageinfo: "Please fill in your Profile",
					},
					widgets: []
				}
			};
			res.render('profile', params);
		});
	});

};

/**
 * mainProfileSave()
 * @param req
 * @param res
 */
exports.mainProfileSave = function(req, res) {
	// get Session Details
	var session_id = nconf.get('site:fakedSession');
	var parseApp = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));
	var session_id;
	var geo_location = lookup.geolookup.getCurrent(req);
	var objectId = req.params[0];
	if (objectId == '') {
		errorPage(res, "We were unable to locate this spot (missing ID).");
	}
	// this is how we get User Data ..
	Datasession.getuser(req, function(err, response, body){
		if (body.length == 0) {
			return kickOut(res, "Please login again, it seems your session has expired.");
		}
		var localdata = body[0];		
		var user_id = localdata.objectId;
		var session_id = localdata.UserPointer.objectId;

	});
}

function kickOut(res, mesg) {
	res.redirect("/main/login?txt="+encodeURIComponent(mesg));
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
