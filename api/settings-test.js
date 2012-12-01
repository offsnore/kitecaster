var fs    = require('fs'),
nconf = require('nconf');
require('nconf-redis');

nconf.use('redis', { host: '173.246.40.121', port: 6379, ttl: 60 * 60 * 1000 });
//
  // Setup nconf to use (in-order):
  //   1. Command-line arguments
  //   2. Environment variables
  //   3. A file located at 'path/to/config.json'
  //
/*  nconf.argv()
       .env()
       .file({ file: 'settings.json' });
*/

console.log('appId', nconf.get('parse.appId'));
