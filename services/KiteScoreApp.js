var service = require('./KiteScoreService'),
    nconf = require('nconf'),
    colors = require('colors')
    ;
console.log('here'); 

nconf.argv()
       .env()
       .file({ file: require('path').resolve(__dirname, '../settings.json') });
   
       
   console.log('Starting cache...'.blue);
   service.startPrecache( function(err, response) {
      if (err) console.log('Error starting precache operation: ' + err);
      console.log('Precaching started, size: ' + response.count);
      
   },nconf.get("api:kitescore:refreshSeconds"));
