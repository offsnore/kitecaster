node-maxmind-native
=============

Simple and quick search on maxmind files to identify the country.

Fork for https://github.com/roymap/node-maxmind-native with new node.js version support and build in maxming geoip file.

Install
=============

	npm install maxmind-native


Example
=============

	// build in maxmind file
	var geoip = new require('maxmind-native').GeoIP();
	// custom maxmind file
    var geoip = new require('maxmind-native').GeoIP('GeoIP.dat');
    
    var country = geoip.getCountry(ip); // '173.194.32.200' -> 'United States'
    var country = geoip.getCountry(ip, 'code3'); // '173.194.32.200' -> 'USA'
    var country = geoip.getCountry(ip, 'code'); // '173.194.32.200' -> 'US'
    