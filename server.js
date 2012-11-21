
/**
 * Module dependencies. 
 */


var express = require('express')
  , routes = require('./routes') 
  , http = require('http')
  , crypto = require('crypto')
  , fs = require('fs')
  , path = require('path')
  , Parse = require('parse-api').Parse;


var app = express();


var MASTER_KEY = '2bCmZB3F7qE8VebWUNHUzi1OzZnLivenQmiSGT4M';
var APP_ID = 'NxEj8t7POeTJEnm3CizoU1MQZlNexcQpHTxgWhwa';

var parseApp = new Parse(APP_ID, MASTER_KEY);
    
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
  app.set('port',  process.env.PORT ||  8000);
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

/**
   SPOT API
**/

app.get('/spot', function(req, res) {
   res.send('list all spots API'); 
});

app.get('/spot/:id', function(req, res) {
   res.send('get spot id API: ' + req.params.id);
});

app.post('/spot', function(req, res) {
   res.send('add spot API');
});

app.put('/spot/:id', function(req, res){
   res.send('update spot id: ' + req.params.id);
});









console.log('routes: ' + JSON.stringify(app.routes));

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

