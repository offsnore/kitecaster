 
/**
 * Test version of the web server
 */




var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , fs = require('fs')
  , path = require('path')
  , Parse = require('parse-api').Parse
  , mongoose = require('mongoose');


var app = express();


var MASTER_KEY = '';
var APP_ID = '';

var parseApp = new Parse(APP_ID, MASTER_KEY);
    
// add a Foo object, { foo: 'bar' }
/*
parseApp.insert('Foo', { foo: 'bar' }, function (err, response) {
  console.log('parse response: ' + JSON.stringify(response) + ', error: ' + err);
  var id = response.id;
  console.log('response object id: ' + id);
});    


parseApp.find('Foo', { foo: 'bar' }, function (err, response) {
  console.log(response);
});
*/
app.configure(function(){
  app.set('port', 3000);
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
app.get('/api', function (req, res){
   res.send('kitecaster API is running');
});
app.get('/api/email', routes.email);



console.log('routes: ' + JSON.stringify(app.routes));


//var app = module.exports = express.createServer({key: privateKey, cert: certificate});

//console.log("app config: " + app.toString());	

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

