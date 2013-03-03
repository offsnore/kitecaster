var redis = require("redis"),
        client = redis.createClient();

    // if you'd like to select database 3, instead of 0 (default), call
    // client.select(3, function() { /* ... */ });

    client.on("error", function (err) {
        console.log("Error " + err);
    });

    // string
    client.set("string key", "string val", redis.print);
    
    //hash 
    client.hset("hash key", "hashtest 1", "some value", redis.print);
    client.hset(["hash key", "hashtest 2", "some other value"], redis.print);
    client.hkeys("hash key", function (err, replies) {
        console.log(replies.length + " replies:");
        replies.forEach(function (reply, i) {
            console.log("    " + i + ": " + reply);
        });
       
    });
    
    //set 
    
    client.sadd("numbers:odd", "11", "13", "15", redis.print);
    
    client.set("foo", "bar");
    client.get("foo",  function(err, reply) {
          // reply is null when the key is missing
          console.log(reply);
      });
    client.get("foo", redis.print);     
    client.sadd('friends:marty', 'zach');
    
      client.hmset("hosts", "mjr", "1", "another", "23", "home", "1234");
   client.hgetall("hosts", function (err, obj) {
      console.log('hosts hash: ');
       console.dir(obj);
   });
    
   client.set("users:andy:spotId", 1234, redis.print);
   client.get("users:andy:spotId", redis.print);
   
   client.exists("host", function (err, replies) {
         console.log('host exists? ' + (replies === 1));      
   });
   
      client.exists("hostx", function (err, replies) {
         console.log('hostx exists? ' + (replies === 1));      
   });

   /*
   for (var i = 0; i < 5; i++) {
      client.incr("spotId", redis.print);      
   };
*/
// pipelining


   client.hset('log', 'redis-test', new Date() + ' - this is a test entry' );
   
   


    client.quit();
