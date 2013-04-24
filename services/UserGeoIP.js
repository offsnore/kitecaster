var app = module.exports.geolookup = {};

app.getCurrent = function(req) {
	var ip = req.headers['X-Forwarded-For'] || req.header('x-forwarded-for') || re.connection.remoteAddress;

	console.log('what we lloking at son!', ip);

	var sys = require('util'),
	    geoip = require('../node_modules/node-geoloc/lib/geoip');	
	var geo = geoip.lookup(ip);
	var d = {
		'default': true,
		'range': [],
		'country': 'US',
		'region': 'HI',
		'city': 'Maui',
		'll': [
			20.816537,
			-156.027336
		]
	};
	if (geo) {
		return geo;
	} else {
		return d;
	}
}
