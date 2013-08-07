var   cronJob = require('cron').CronJob
    , exec = require('child_process').exec
    , syncExecold = require('exec-sync')
    , syncExec = require("exec-plan").ExecPlan
    , Datastore = require('../services/DataStore.js')
    , Jenny = require('../services/KiteSpotJennyBot.js')
    , nconf = require('nconf')
    , sleep = require('sleep')
    ;

// CronTime: * * * * * * => once per second
// CronTime: 00 * * * * * => once per minute
// CronTime: 00 00 * * * * => once per hour
// CronTime: 00 00 00 * * * => Once per Day (at midnight)

try {
    var job = new cronJob({
//      cronTime: '00 00 06 * * *',
      cronTime: '00 * * * * *',
      onTick: function() {
          Jenny.getHotSpots();
      },
      start: true
    });
    job.start();
} catch (e) {
    console.log(e);
}