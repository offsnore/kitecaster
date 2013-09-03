var   cronJob = require('cron').CronJob
    , exec = require('child_process').exec
    , syncExecold = require('exec-sync')
    , syncExec = require("exec-plan").ExecPlan
    , Datastore = require('../services/DataStore.js')
    , nconf = require('nconf')
    , sleep = require('sleep')
    ;

// CronTime: * * * * * * => once per second
// CronTime: 00 * * * * * => once per minute
// CronTime: 00 00 * * * * => once per hour


try {
    var job = new cronJob({
      cronTime: '00 00 * * * *',
      onTick: function() {
        var queryParams = {};

        var running = 0;
        syncPlan = new syncExec();
        
        syncPlan.on("execerror", function(err, strerr) {
            console.log(err);
            console.log(strerr);
        });
        
        syncPlan.on("complete", function(stdout) {
            var running = 0;
            console.log(stdout);
            console.log("set complete");
        });
        
        syncPlan.on("finished", function() {
            var running = 0;
            console.log("set finished");
        });

    	// Use DataStore Instead
    	Datastore.records.object("Spot", queryParams, function(err, response, body, success) {
            if (body.length > 0) {
                var counter = 0;
                var spot_id;
                for (item in body) {
                    var query, picture_path;
                    spot_id = body[item].spotId;
                    // @NOTE - This path must be relative to the FIRST LEVEL, /var/http/www.kitecaster/ <- first would be the first level
                    picture_path = require('path').resolve('./public/media/raw/');
                    script_path = require('path').resolve(__dirname + '/scripts/graph_generate.js');
                    query = "phantomjs " + script_path + " http://www.kitecaster.com/main/r/system-generated/spot-" + spot_id + ".html " + picture_path + "/spot-" + spot_id + "-auto.png";
                    syncPlan.add(query);
                }
                syncPlan.execute();
            }
    
    	});
    
      },
      start: true
    });
    job.start();
} catch (e) {
    console.log(e);
}
