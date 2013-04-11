var app = module.exports.geolookup = {};

app.getCurrent = function(req) {
	if (req.headers['X-Forwarded-For']) {
		var ip = req.headers['X-Forwarded-For'];
	} else {
		var ip = req.connection.remoteAddress;
	}
	var sys = require('util'),
	    geoip = require('../node_modules/node-geoloc/lib/geoip');	
	var geo = geoip.lookup(ip);
	if (geo) {
		return geo;
	} else {
		return {};
	}
}