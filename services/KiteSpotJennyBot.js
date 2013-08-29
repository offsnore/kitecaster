/**
 * @Otherwise known as 'jenny'
 */

var datastore = require('./DataStore')
	,	finder = require('./SessionFinderService')
	,	nconf = require('nconf')
	,	redis = require('redis')
	,	colors = require('colors')
	,	jade = require('jade')
	,   async = require('async')
	,	fs = require('fs');

nconf.argv()
       .env()
       .file({ file: require('path').resolve(__dirname, '../settings.json') });

var client = redis.createClient();
var app = module.exports;

app.getHotSpots = function(user_id, process, method_callback) {
	var force = false, d_results = [];

	if (typeof method_callback !== 'function') {
    	var method_callback = function(){};
	}

	if (!process) {
    	process = false;
	}

	var query_params = {
		'where': {"UserPointer":{"__type":"Pointer","className":"_User","objectId": user_id}}
	};

	datastore.records.object("Profiles", query_params, function(err, response, data){

    	if (data.length == 0) {
        	method_callback();
        	return false;
    	}

    	var obj = data[0];
    	
		var user_id = obj.UserPointer.objectId;

		var query_params = {
			'where': {
				userId: user_id
			}
		};
	
		console.log("looping through " + user_id + "(" + obj.email + ") to get spots");

		process = false;

		async.waterfall([
            function(callback_ext) {
                var d_res = [];
                datastore.records.object("Subscribe", query_params, function(err, response, data){
                	d_data = data;
                	callback_ext(null, d_data);
                });
            },
            function(data, callback_ext) {

                async.waterfall([
                    function(callback_ext_a) {
                        var max = (parseInt(data.length) - 1), counter = 0, c_data = [], a_data = [];
        				data.forEach(function(item, i, obj){
        					var spotId = item.spotId;
        					var qp = {
        						'where': {
        							spotId: parseInt(spotId)
        						}
        					};
                            datastore.records.object("Spot", qp, function(err, response, data){
                                for(var i in data) {
                                    var obj = data[i];
                                    a_data.push(obj);
                                }
                                counter += 1;
                				if (counter == max) {
                                    callback_ext_a(null, a_data);            				
                				}
                            });
        				})
        				        				
        				// Add check for no max - return false
                    },
                    function(data, callback_ext_a) {
                        var a_data = {}, counter = 0, max = (data.length - 1);
                        data.forEach(function(item, i, obj){
        					var spotId = item.spotId;
        					var qp = {
        						'where': {
        							spotId: parseInt(spotId)
        						}
        					};
                            datastore.records.object("Spot", qp, function(err, response, data){
                                console.log(counter, max);
                                a_data[spotId] = data;                                
                                if (counter == max) {
                                    callback_ext_a(null, a_data);
                                }
                                counter += 1;
                            })
                        })
                    },
                    function(data, callback_ext_a) {
                        var a_data = [], counter = 0, max = (data.length - 1);
                        for(var i in data) {
                            var obj = data[i];
                            console.log(obj);
/*
                            var redis10DayKey = "scores:10day:spot:" + obj.spotId;
                            var flagged = false, dark = false;
                        	client.get(redis10DayKey, function(err, reply) {
                        		if (reply && force === false) {
                        			c_data.push(JSON.parse(reply));
                        		}
                        	});
*/
                        }
//                        console.log(data);
                    }
                ])

            }
		]);

				/*

		async.waterfall([
			function(callback){
				var d_results = [];
//					var d_data = [], c_data = [];
				console.log('callback 1-1');
				async.waterfall([
					function(callback_ext) {
						var d_data = [];
						console.log('callback 2-1');
	        			datastore.records.object("Subscribe", query_params, function(err, response, data){
	        				d_data = data;
	        				callback_ext(null, d_data);
		        		});
		        	},
		        	function(d_data, callback_ext) {
		        		var c_data = [];
                        var counter = 0;
                        var max = (d_data.length ? (d_data.length - 1) : 0);
//							console.log('callback 2-2', d_data);
        				d_data.forEach(function(item, i, obj){
        					var spotId = item.spotId;
        					var qp = {
        						'where': {
        							spotId: parseInt(spotId)
        						}
        					};
                            datastore.records.object("Spot", qp, function(err, response, data){
                                for(var i in data) {
                                    var obj = data[i];
                                    var redis10DayKey = "scores:10day:spot:" + obj.spotId;
                                    var flagged = false, dark = false;
                                	client.get(redis10DayKey, function(err, reply) {
                                		if (reply && force === false) {
                                			c_data.push(JSON.parse(reply));
                                		}
                                	});
                                }
                                counter++;
	                        });
                        	if (counter == max) {
                            	callback_ext(null, d_data, c_data);
                        	}
	                    });
		        	},
		        	function(d_data, c_data, callback_ext) {
						console.log('callback 2-3');
		        		org_data = [];
		        		if (typeof c_data !== 'undefined') {
			        		var org_data = c_data[0];				        		
		        		}
		        		if (typeof org_data === 'undefined') {
        					callback_ext(null, []);
			        		return true;
		        		}
		        		if (org_data.length < 1) {
		        			callback_ext(null, []);
		        			return true;
		        		}
            			finder.buildSessionSearch({ spotId: obj.spotId }, org_data, function(err, results){
            				if (process !== false) {
            				    console.log('Ran session search building on test spot and dummy data. Got Result, wooeey!!');
//                					app.processHotSpot(obj, results);
            				} else {
            					console.log('processin..');
            					d_results.push([obj, results]);
            				}
            				callback_ext(null, d_results);
            				callback(null, d_results);
            			});
		        	}
				])
				callback(null, true);
			}
		], function() {
			console.log('callback 1-2');
			//	method_callback(d_results);					
		});
	
				*/
	});

/*
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
*/
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
//app.getHotSpots('xmkIMtFLKe', false, function(data){ 
//	console.log('yo');
//})
