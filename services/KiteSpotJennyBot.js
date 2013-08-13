/**
 * @Otherwise known as 'jenny'
 */

var datastore = require('./DataStore')
	,	finder = require('./SessionFinderService')
	,	nconf = require('nconf')
	,	redis = require('redis')
	,	colors = require('colors')
	,	jade = require('jade')
	,	fs = require('fs');

nconf.argv()
       .env()
       .file({ file: require('path').resolve(__dirname, '../settings.json') });

var client = redis.createClient();
var app = module.exports;

app.getHotSpots = function(callback) {
	var force = false;

	var query_params = {
		'where': {"UserPointer":{"__type":"Pointer","className":"_User","objectId": 'xmkIMtFLKe'}}
	};

	datastore.records.object("Profiles", query_params, function(err, response, data){

		data.forEach(function(obj) {
			var user_id = obj.UserPointer.objectId;

			var query_params = {
				'where': {
					userId: user_id
				}
			};
		
			console.log("looping through " + user_id + "(" + obj.email + ") to get spots");
		
			datastore.records.object("Subscribe", query_params, function(err, response, data){
				data.forEach(function(item, i, obj){
					var spotId = item.spotId;
					var qp = {
						'where': {
							spotId: parseInt(spotId)
						}
					};
					datastore.records.object("Spot", qp, function(err, response, data){
						var flagged_time = new Array();
					    for(var i in data) {
					        var obj = data[i];
					        console.log(obj.spotId);
					        var redis10DayKey = "scores:10day:spot:" + obj.spotId;
					        var flagged = false, dark = false;
							client.get(redis10DayKey, function(err, reply) {
								if (reply && force === false) {
									var obj_data = JSON.parse(reply);
									finder.buildSessionSearch({ spotId: obj.spotId }, obj_data, function(err, results){
										console.log('Ran session search building on test spot and dummy data. Got Result, wooeey!!');
										app.processHotSpot(obj, results);
									});
								} else {
									console.log("not found, bail.");
								}
							});
					    }
					});
		
				});
			});

		});
	
	});

	return false;

	var spot_id = 127;

	var query_params = {
		'where': {
			spotId: parseInt(spot_id)
		}
	};	
	var require_score = 8;

	console.log("-------");	
	console.log("getting for spot: " + spot_id);
	console.log("-------");

	datastore.records.object("Spot", query_params, function(err, response, data){
		var flagged_time = new Array();
	    for(var i in data) {
	        var obj = data[i];
	        console.log(obj.spotId);
	        var redis10DayKey = "scores:10day:spot:" + obj.spotId;
	        var flagged = false, dark = false;
			client.get(redis10DayKey, function(err, reply) {
				if (reply && force === false) {
					var obj_data = JSON.parse(reply);
					finder.buildSessionSearch({ spotId: obj.spotId }, obj_data, function(err, results){
						console.log('Ran session search building on test spot and dummy data. Got Result, wooeey!!');
						console.log(JSON.stringify(results, null, 4));
					});
				} else {
					console.log("not found, bail.");
				}
			});
	    }
	});
}

var flagged = new Array();

/**
 * Takes the random bits of data and pushes them into Same-Days
 */
app.processHotSpot = function(spot_data, data) {
	var final_set = data;
	delete final_set.spot_id;
	this.parseHotInfo(spot_data.name, spot_data.spotId, final_set);
	
	/**
	data.forEach(function(i, item){
		if (typeof final_set[data[item].datestamp] == 'undefined') {
			final_set[data[item].datestamp] = new Array();
		}
		final_set[data[item].datestamp].push(data[item]);
	});
	*/
};

/**
 * Parsed out important information to reveal actual data that is useful
 */
app.parseHotInfo = function(name, spot_id, data) {
	var parsed = "", found_one = false;
	parsed += "<p class='callout'><h3>Hot Spots for <a href='http://www.kitecaster.com/main/p/" + name + "/spot-" + spot_id + ".html?_utm=email&ct=h1'>" + name + "</a></h3>\n";

	for (var i in data) {
		var obj = data[i];
		var max = obj.maxScore;
		if (max.score < 6) {
			continue;
		}
		found_one = true;
		parsed += "<h5>The best time to go kiting here on " + i + " is " + (max.hour > 12 ? (parseInt(max.hour) - 12) : max.hour) + (max.hour < 12 ? " AM" : " PM") + " - we predict a kiting score of " + max.score + ".</h5><p>\n";

	/** hide this for now
		for (var b in obj) {
			if (typeof obj[b].hour === 'undefined') {
				continue;
			}
			parsed += (obj[b].hour > 12 ? (parseInt(obj[b].hour) - 12) : obj[b].hour) + (obj[b].hour < 12 ? " AM" : " PM") + " (score: " + obj[b].score + "), ";
		}
		obj.forEach(function(i, item){
			parsed += obj[item].hour + " (score: " + obj[item].score + "), ";
		});
		parsed += "</p>";
	**/
	}
	parsed += "<a href='http://www.kitecaster.com/main/p/" + name + "/spot-" + spot_id + ".html?_utm=email&ct=h2'> Check out the full graph on KiteCaster &raquo;</a></p>\n";

	if (!found_one) {
		return false;
	}

    var layout_path = require('path').resolve(__dirname, "../views/email/daily.jade");

    //@todo - make these come form the Spots ...
    var emails = ['kylejeske@gmail.com'];

    for (var x in emails) {
	    var layout = fs.readFileSync(layout_path, 'utf8');
	    var layout = jade.compile(layout, {pretty: true, filename: layout_path });
	    var params = {
	    	'email': emails[x],
		    'parsed': parsed
	    };
	    var content = layout(params);
	    var replyto_address = "noreply@kitecaster.com";
	    var subject = 'Check out these hot kiting time at ' + name + '! Kitecaster.com';
	    var from_address = 'Forecaster Jenny <jenny.the.forecaster@kitecaster.com>';
	    app.sendEmail(from_address, emails[x], subject, content);
    }
}

app.sendWelcomeEmail = function(name, to_email) {
    var layout_path = require('path').resolve(__dirname, "../views/email/welcome.jade");

    //@todo - make these come form the Spots ...
    var emails = ['kylejeske@gmail.com'];

    var layout = fs.readFileSync(layout_path, 'utf8');
    var layout = jade.compile(layout, {pretty: true, filename: layout_path });
    var params = {
    	'email': to_email,
	    'name': name,
	    'parsed': ""
    };
    var content = layout(params);
    var replyto_address = "noreply@kitecaster.com";
    var subject = 'Check out a few cool things at KiteCaster.com! (Welcome Email)';
    var from_address = 'Andrew @ KiteCaster Team <andrew@kitecaster.com>';
    app.sendEmail(from_address, to_email, subject, content);
	
}

app.sendEmail = function(from_address, to_address, subject, content, replyto_address) {
	if (replyto_address == null) {
		replyto_address = 'noreply@kitecaster.com';
	}
    var value_string = 'From: ' + from_address +
	    	'\nTo: ' + to_address +
	    	'\nReply-To: ' + replyto_address + 
	    	'\nSubject: ' + subject +
	    	'\nContent-Type: text/html; charset=utf-8' + 
	    	content;
    var Mailgun = require('mailgun').Mailgun;
    var mg = new Mailgun('key-3dtafmsevzkomn1xut1tqgbqsg36-nv6');
    mg.sendRaw(
    	from_address,
    	to_address,
	    	value_string,
    	function(err) {
	    	if (err) {
		    	console.log('Oh noes: ' + err);            
	        } else {
		        console.log('done');
	        }
	   });
}


//app.sendWelcomeEmail("Andrew Anderson", "picasandrew@gmail.com");
//app.sendWelcomeEmail("Kyle Jeske", "kylejeske@gmail.com");
app.getHotSpots(function(){ 
	console.log('yo');
})
