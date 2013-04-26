var datastore = require('../services/DataStore');

datastore.getCurrent('foo', 'bar', function(result) {
   console.log('got hash: '  + result);
});

var hash = datastore.generateHash('foo', 'bar');
console.log('hash: ' + hash);