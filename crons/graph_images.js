var   cronJob = require('cron').CronJob
    , exec = require('child_process').exec
    , syncExec = require('exec-sync')
    , Datastore = require('../services/DataStore.js')
    , nconf = require('nconf')
    , sleep = require('sleep')
    ;

// CronTime: * * * * * * => once per second
// CronTime: 00 * * * * * => once per minute
// CronTime: 00 00 * * * * => once per hour

var job = new cronJob({
  cronTime: '00 * * * * *',
  onTick: function() {
    var queryParams = {};

	// Use DataStore Instead
	Datastore.records.object("Spot", queryParams, function(err, response, body, success) {
        if (body.length > 0) {
            var counter = 0;
            var spot_id;
            for (item in body) {
                if (counter == 10) {
                    counter = 0;
                    console.log('waiting for next batch...');
                    sleep.sleep(1);
                }
                spot_id = body[item].spotId;
                syncExec("phantomjs scripts/graph_generate.js http://local.kitecaster.com/main/r/system-generated/spot-" + spot_id + ".html ../public/media/raw/spot-" + spot_id + "-auto.png", function(){
                    console.log(arguments);
                })
                counter += 1;
            }
        }

	});

  },
  start: true
});
job.start();
