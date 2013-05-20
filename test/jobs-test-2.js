var Convoy = require('redis-convoy');

var q = Convoy.createQueue("monsterTrucks");

//q.clearJammedJobs(1000, function(){
//    console.log('checked?');
//});

//q.jamGuard(1000, function(){
//  console.log('jam guard'); 
//});

q.process(function(obj, callback){
    console.log('processing..');
    if (typeof obj.fn == 'function') {
        obj.fn();
    }
    callback();
});

process.on("SIGINT", function(){
    q.stopProcessing();
    q.close();  
});

//q.startProcessing();

//q.close();
