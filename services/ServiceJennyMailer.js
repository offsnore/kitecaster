var     datastore = require('./DataStore')
    ,   JennyBot = require('./KiteSpotJennyBot');


var app = module.exports;

app.sendEmails = function(method_callback) {

    if (typeof method_callback !== 'function') {
        var method_callback = function(){};
    }

	var query_params = {
		'where': {
		    "UserPointer":{
		        "__type":"Pointer",
		        "className":"_User"
            }
        },
	};

    // hard set private_beta til were done testing
    var query_params = {
        'where': {
            'private_beta': true
        },
        'limit': 5
    };

	datastore.records.object("Profiles", query_params, function(err, response, data){
    	if (data.length == 0) {
        	method_callback();
        	return false;
    	}    	
    	for(i in data) {
    	    var id, email_addy;
    	    id = data[i].UserPointer.objectId;
    	    email_addy = data[i].email;
            JennyBot.getHotSpots(id, false, function(data){
                var data_today, data_weekly;
                data.today = JennyBot.get_top_three(data);
                data_today = JennyBot.parse_daily(data);

                JennyBot.parseDailyEmail(email_addy, data_today, function(){
                    console.log('daily email sent to :' + email_addy);
                });
//                data_weekly = JennyBot.get_top_three(data, true);
//                console.log(JSON.stringify(data_today));
            });
    	}
    });   
}
