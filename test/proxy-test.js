var http = require('http'),
    httpProxy = require('http-proxy');
    
    var options = {
     router: {
       'localhost:80/spot': '127.0.0.1:8501'
     }
};

var proxyServer = httpProxy.createServer(options);
proxyServer.listen(8000);
console.log('proxy running');
