
/**
 * Do a general pull for Global Site Configs
 */
var nconf = require('nconf');

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
		}
	}
	res.render('main', params);
};

// Spots Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.mainSpot = function(req, res) {
	var params = {
		page: {
			active: 'Spots',
		},
		title: nconf.get('site:frontend:title'),
		credits: "testing",
		body: {
			content: {
				pageinfo: "first entry into spots page"
			}
		}
	}
	res.render('main', params);
};


// Profile Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.mainProfile = function(req, res) {
	var params = {
		page: {
			active: 'Profile',
		},
		title: nconf.get('site:frontend:title'),
		credits: "testing",
		body: {
			content: {
				pageinfo: "first entry into profile page",
			}
		}
	}
	res.render('main', params);
};
