var 	Twit = require('twit')
	,	nconf = require('nconf');

var TwitterService = function() {
	nconf.argv()
	       .env()
	       .file({ file: require('path').resolve(__dirname, '../settings.json') });
	
	var T = new Twit({
	    consumer_key: nconf.get('twitter:consumer_key'),
	    consumer_secret: nconf.get('twitter:consumer_secret'),
	    access_token: nconf.get('twitter:access_token'),
	    access_token_secret: nconf.get('twitter:consumer_key_secret')
	});

	return {
		'update': function(status){
			T.post('statuses/update', 
				{ 
					status: status 
				}, 
				function(err, reply) {
					console.log(err, reply);
				}
			)
		}
	}
};

module.exports = TwitterService;