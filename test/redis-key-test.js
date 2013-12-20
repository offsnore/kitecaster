var datastore = require('../services/DataStore')
    sleep = require('sleep');

datastore.getnamespace(function(namespace){

    /**
    test for incrementing values
    var key = datastore.namespace_key;
    datastore.incrementnamespace(key, function(replies){
        console.log(key, replies);
    });
    **/
    
    var key = {'test':'133'};
    var db = "spot";
    datastore.createkey(db, key, function(key){
        console.log(key);
    });

});

