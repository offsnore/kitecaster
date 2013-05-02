var datastore = require('../services/DataStore'),
	sleep = require('sleep');

console.log('checking for local ...');

//datastore.getlocalobject('foo', 'bar', function(res){
//	console.log("Record returned: " + JSON.stringify(res));
//});

//sleep.sleep(3);

//datastore.setobject('foo', 'bar', 3600, function(){
//	console.log("Set object into local cache.");
//});

datastore.records.object('foo', 'bar', function(err, res){
	console.log(res);
});

/**
sleep.sleep(5);

datastore.records.object('foo', 'bar', function(result) {
   console.log('got hash: '  + result);
});

sleep.sleep(5);

var hashkey = datastore.createkey('foo', 'bar');
console.log("generated key: " + hashkey);

sleep.sleep(5);


sleep.sleep(5);

datastore.getlocalobject('foo', 'bar', function(res){
	console.log("Local Record returned: " + JSON.stringify(res));
});

sleep.sleep(5);
**/


//var hash = datastore.generateHash('foo', 'bar');
//console.log('hash: ' + hash);
