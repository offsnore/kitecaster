Node Parse API
==============

install
-------

    npm install parse-api

examples
--------

### setup

    var Parse = require('parse-api').Parse;
    
    var APP_ID = ...;
    var MASTER_KEY = ...;
    
    var app = new Parse(APP_ID, MASTER_KEY);

### insert

    // add a Foo object, { foo: 'bar' }
    app.insert('Foo', { foo: 'bar' }, function (err, response) {
      console.log(response);
    });

### insert file
	var fs = require('fs'),
		fileName = 'myMedia.mp3';
	fs.readFile(fileName, function (err, data) {
		if (err) throw err;
		app.insertFile(fileName, data, 'audio/mpeg', function(err, response){
			if(err) throw err;
			console.log('Name: ' + response.name);
			console.log('Url: ' + response.url);
		});
	});
	 
### send global push notification
	app.push({channel: "", data: {alert: "Notification ", sound: ""}}, function (err, response) {
	console.log(response);
	});

### find one

    // the Foo with id = 'someId'
    app.find('Foo', 'someId', function (err, response) {
      console.log(response);
    });

### find many

    // all Foo objects with foo = 'bar'
    app.find('Foo', { foo: 'bar' }, function (err, response) {
      console.log(response);
    });


### find many with ordered

    // all Foo objects with foo = 'bar' and order by 'id'
    app.find('Foo', { foo: 'bar', order: 'id'}, function (err, response) {
      console.log(response);
    });


### find many with limited

    // all Foo objects with foo = 'bar' and limited by 10
    app.find('Foo', { foo: 'bar', limit: 10}, function (err, response) {
      console.log(response);
    });


### update

    app.update('Foo', 'someId', { foo: 'fubar' }, function (err, response) {
      console.log(response);
    });

### delete

    app.delete('Foo', 'someId', function (err) {
      // nothing to see here
    });
