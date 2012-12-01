
/**
 * Module dependencies. 
 */


var express = require('express')
  , routes = require('./routes') 
  , http = require('http')
  , crypto = require('crypto')
  , fs = require('fs')
  , path = require('path')
  , Parse = require('parse-api').Parse
  , restify = require('restify')
  , nconf = require('nconf')
  ;

var app = express();

//
  // Setup nconf to use (in-order):
  //   1. Command-line arguments
  //   2. Environment variables
  //   3. A file located at 'path/to/config.json'
  //
nconf.argv()
       .env()
       .file({ file:'settings.json' });

console.log('appId: ' + nconf.get('parse.appId'));
var parseApp = new Parse(nconf.get('parse.appId'), nconf.get('parse.master'));
    
// add a Foo object, { foo: 'bar' }
/*
parseApp.insert('Foo', { foo: 'bar' }, function (err, response) {
  console.log('parse response: ' + JSON.stringify(response) + ', error: ' + err);
  var id = response.id;
  console.log('response object id: ' + id);
});    
*/

parseApp.find('EmailObject', {}, function (err, response) {
  console.log(response);
});

app.configure(function(){
  app.set('port',  app.settings.env.PORT ||  8000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

/*
   URL Mappings
*/ 

app.get('/', routes.index);
app.get('/api', function (req, res){
   res.send('kitecaster API is running');
});
app.get('/example', routes.example);


/* Start API Apps */




console.log('routes: ' + JSON.stringify(app.routes));

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

