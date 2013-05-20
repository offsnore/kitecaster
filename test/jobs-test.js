var Convoy = require('redis-convoy');

var q = Convoy.createQueue("monsterTrucks");

var start = 0;
var max = 10;
var i = 0;

//for (i=0; i < max; i++) {
    var jobID = 1;
    var job = new Convoy.Job(jobID, function(){
            console.log("executing job...");        
        });
    q.addJob(job);

//}

//q.startProcessing();

//q.close();
