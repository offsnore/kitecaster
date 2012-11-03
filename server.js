
/**
 * Module dependencies. test 1 2
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

parseApp.find('Foo', { foo: 'bar' }, function (err, response) {
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
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/test', routes.test);
app.get('/example', routes.example);

console.log('routes: ' + JSON.stringify(app.routes));

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
