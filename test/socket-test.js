var nconf = require('nconf');
var io = require('socket.io').listen(80);

  nconf.argv()
       .env()
       .file({ file: '../settings.json' });


io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
});