var qs = require('querystring');

module.exports = Parse;

function Parse(application_id, master_key) {
  this._application_id = application_id;
  this._master_key = master_key;
}

Parse.prototype = {
  _api_protocol: require('https'),
  _api_host: 'api.parse.com',
  _api_port: 443,
  
  // add object to class store
  insert: function (className, object, callback) {
    parseRequest.call(this, 'POST', '/1/classes/' + className, object, callback);
  },
  
    // send push notification
  push: function (data, callback) {
    parseRequest.call(this, 'POST', '/1/push', data, callback);
  },
  
  // register new user
  register: function (data, callback) {
    parseRequest.call(this, 'POST', '/1/users', data, function(err, response){
    	if (err) callback(err, data);
    	else {
    		for (var property in response) {
		        if (response.hasOwnProperty(property)) {
        		    data[property] = response[property];
    		    }
		    }
		    callback(null, data);
    	}
    });
  },
  
  login: function (data, callback) {
    parseRequest.call(this, 'GET', '/1/login', data, callback);
  },
  
  passwordReset: function (data, callback) {
    parseRequest.call(this, 'POST', '/1/requestPasswordReset', data, callback);
  },
  
  findUser: function (data, callback) {
    parseRequest.call(this, 'GET', '/1/users/'+data.objectId, null, callback);
  },
  
  updateUser: function (userID, data, callback) {
    parseRequest.call(this, 'PUT', '/1/users/'+userID, data, callback);
  },
  
  deleteUser: function (data, callback) {
    parseRequest.call(this, 'DELETE', '/1/users/'+data.objectId, data, callback);
  },
  
    // add files
  insertFile: function(fileName, data, contentType, callback){
  	parseRequest.call(this, 'POST', '/1/files/' + fileName, data, callback, contentType);
  },
  
  // get objects from class store
  find: function (className, query, callback) {
    if (typeof query === 'string') {
      parseRequest.call(this, 'GET', '/1/classes/' + className + '/' + query, null, callback);
    } else {
            var queryToSubmit = {};
      if (query.limit) {
        queryToSubmit.limit = query.limit;
        delete query.limit;
      }
      if (query.skip) {
        queryToSubmit.skip = query.skip;
        delete query.skip;
	  }
      if (query.order) {
        queryToSubmit.order = query.order;
        delete query.order;
	  }
	  queryToSubmit.where = JSON.stringify(query);
      parseRequest.call(this, 'GET', '/1/classes/' + className, queryToSubmit, callback);
    }
  },
  
  // update an object in the class store
  update: function (className, objectId, object, callback) {
    parseRequest.call(this, 'PUT', '/1/classes/' + className + '/' + objectId, object, callback);
  },
  
  // remove an object from the class store
  'delete': function (className, objectId, callback) {
    parseRequest.call(this, 'DELETE', '/1/classes/' + className + '/' + objectId, null, callback);
  }
};

// Parse.com https api request
function parseRequest(method, path, data, callback, contentType) {
  var auth = 'Basic ' + new Buffer(this._application_id + ':' + this._master_key).toString('base64');
  var headers = {
    Authorization: auth,
    Connection: 'Keep-alive'
  };
  
  var body = null;
  
  switch (method) {
    case 'GET':
      if (data) {
        path += '?' + qs.stringify(data);
      }
      break;
    case 'POST':
    case 'PUT':
    	if(contentType){
		 	body = data;     
		 	headers['Content-type'] = contentType;
		 	console.log('Sending data type: ' + contentType + ' of length: ' + body.length);
    	}else{
			headers['Content-type'] = 'application/json';
	   	 	body = JSON.stringify(data);
    	}
      headers['Content-length'] = body.length;
      break;
    case 'DELETE':
      headers['Content-length'] = 0;
      if (data) {
      	if (data.sessionToken) headers['X-Parse-Session-Token'] = data.sessionToken;
      }
      break;
    default:
      throw new Error('Unknown method, "' + method + '"');
  }
  
  var options = {
    host: this._api_host,
    port: this._api_port,
    headers: headers,
    path: path,
    method: method
  };
  
  var req = this._api_protocol.request(options, function (res) {
    if (!callback) {
      return;
    }
    
    if (res.statusCode < 200 || res.statusCode >= 300) {
      var err = new Error('HTTP error ' + res.statusCode);
      err.arguments = arguments;
      err.type = res.statusCode;
      err.options = options;
      err.body = body;
      return callback(err);
    }
    
    var json = '';
    res.setEncoding('utf8');
    
    res.on('data', function (chunk) {
      json += chunk;
    });
    
    res.on('end', function () {
      var err = null;
      var data = null;
      try {
        var data = JSON.parse(json);
      } catch (err) {
      }
      callback(err, data);
    });
    
    res.on('close', function (err) {
      callback(err);
    });
  });
  
  if(contentType)
  {
	body &&	req.write(body,'binary');
  }else{
	body && req.write(body);
  }
  req.end();

  req.on('error', function (err) {
    callback && callback(err);
  });
}
