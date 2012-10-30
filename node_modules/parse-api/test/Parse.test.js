var Parse = require('../index').Parse;

// use environment variables APPLICATION_ID and MASTER_KEY to test against
var application_id = process.env.APPLICATION_ID;
var master_key = process.env.MASTER_KEY;

// require the environment variables, or exit with explanation
if (!application_id || !master_key) {
  console.log('Set the following environment variables for the test Parse app');
  console.log('  export APPLICATION_ID=...');
  console.log('  export MASTER_KEY=...');
  process.exit(1);
}

// global objects to test against
var parse = new Parse(application_id, master_key);
var className = 'NodeParseApiTest';
var object = { foo: Math.floor(Math.random() * 10000) };  // ERROR: if you change the type
var user = { username: generateRandomString(8), password: generateRandomString(8), email:'z@zcs.me' };
var stub;

exports.register = function (assert) {
  parse.register(user, function (err, response) {
  	user = response;
    err && console.log(err);
    assert.ok(response);
    stub = response;
    assert.done();
  });
};

exports.login = function (assert) {
  parse.login(user, function (err, response) {
    err && console.log(err);
    assert.ok(response);
    stub = response;
    assert.done();
  });
};

exports.findUser = function (assert) {
  parse.findUser(user, function (err, response) {
    err && console.log(err);
    assert.ok(response);
    stub = response;
    assert.done();
  });
};

exports.updateUser = function (assert) {
  parse.updateUser(user.objectId, {username:generateRandomString(8)}, function (err, response) {
    err && console.log(err);
    assert.ok(response);
    stub = response;
    assert.done();
  });
};

exports.loginInvalid = function (assert) {
  parse.login(user, function (err, response) {
    assert.ok(err);
    stub = response;
    assert.done();
  });
};

exports.deleteUser = function (assert) {
  parse.deleteUser(user, function (err, response) {
    err && console.log(err);
    assert.ok(response);
    stub = response;
    assert.done();
  });
};

exports.insert = function (assert) {
  parse.insert(className, object, function (err, response) {
    err && console.log(err);
    assert.ok(response);
    stub = response;
    assert.done();
  });
};

exports.find = function (assert) {
  parse.find(className, stub.objectId, function (err, response) {
    assert.equal(object.foo, response.foo);
    assert.done();
  });
};

exports['find many'] = function (assert) {
  parse.find(className, stub, function (err, response) {
    assert.equal(1, response.results.length);
    assert.equal(stub.objectId, response.results[0].objectId);
    assert.equal(stub.createdAt, response.results[0].createdAt);
    assert.equal(object.foo, response.results[0].foo);
    assert.done();
  });
};

exports.update = function (assert) {
  do {
    var num = Math.floor(Math.random() * 10000);
  } while (num == object.foo);
  object.foo = num;
  
  parse.update(className, stub.objectId, object, function (err, response) {
    err && console.log(err);
    assert.ok(response);
    exports.find(assert);  // retest find on the updated object
  });
};

exports['delete'] = function (assert) {
  parse['delete'](className, stub.objectId, function (err) {
    err && console.log(err);
    assert.ok(!err);
    parse.find(className, stub.objectId, function (err, response) {
      assert.equal(404, err.type);
      assert.done();
    });
  });
};

function generateRandomString(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    pos_len = possible.length;
    for (var i=0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * pos_len));
    return text;
}
