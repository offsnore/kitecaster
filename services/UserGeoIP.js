var app = module.exports.geolookup = {};

app.getCurrent = function(req) {
	if (req.headers['x-forwarded-for']) {
		var ip = req.headers['x-forwarded-for'];
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
