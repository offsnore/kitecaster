
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
  , winston = require('winston')
  , colors = require('colors')
  ;
  
var logger = new (winston.Logger)({
    transports: [
      new winston.transports.Console({timestamp:true})
      //new winston.transports.File({ timestamp:true, filename: '/var/logs/kitecaster/server.log' })
    ],
    exceptionHandlers: [
            new winston.transports.Console({timestamp:true})
      //new winston.transports.File({ timestamp:true, filename: '/var/logs/kitecaster/server-exceptions.log' })
    ] 
  });
  
colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow', 
  debug: 'blue',
  error: 'red'
});

var app = express();
var poet    = require('poet')( app );
//
  // Setup nconf to use (in-order):
  //   1. Command-line arguments
  //   2. Environment variables
  //   3. A file located at 'path/to/config.json'
  //
nconf.argv()
       .env()
       .file({ file:'settings.json' });

logger.debug('appId: ' + nconf.get('parse:appId'));
var parseApp = new Parse(nconf.get('parse:appId'), nconf.get('parse:master'));

    
// add a Foo object, { foo: 'bar' }
/*
parseApp.insert('Foo', { foo: 'bar' }, function (err, response) {
  logger.debug('parse response: ' + JSON.stringify(response) + ', error: ' + err);
  var id = response.id;
  logger.debug('response object id: ' + id);
});    
*/

parseApp.find('EmailObject', {}, function (err, response) {
  logger.debug(response);
});

app.configure(function(){
  app.set('port',  app.settings.env.PORT || nconf.get('env:port') || 8000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.engine('html', require('ejs').renderFile);
});

app.use(function(req, res, next){
     res.locals._ = require('underscore');
        next();
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


app.get('/api', function (req, res){
   res.send('kitecaster API is running');
});
app.get('/example', routes.example);
app.get('/foo', function(req, res) {
   res.render( 'index', {title: 'foo', body:'bar'});
});
app.get('/start', routes.start);

// @todo make this routing come from a config file and executed via a LOOP
app.get('/main', routes.mainIndex);
app.get('/main/spots', routes.mainSpot);
app.get('/main/profile', routes.mainProfile);

app.post('/main/profile/save', routes.mainProfileSave);

/* Start API Apps */

logger.debug('routes: ', JSON.stringify(app.routes));


var server = http.createServer(app).listen(app.get('port'), function(){
        logger.debug("Express server listening on port " + app.get('port'));
           })
   , io = require('socket.io').listen(server);

io.sockets.on('connection', function (socket) {
   logger.debug('client connected');
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    logger.debug(data);
  });
});





