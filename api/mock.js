var restify = require('restify');
    
    // Create server
var server = restify.createServer();

//-----

server.listen(8666, function() {
  console.log('%s listening at %s', server.name, server.url);
});


server.get('/mock', function(req, res) {
   res.send('Mock service for local development');
});


// Mock data

server.get('/mock/spot', function(req, res) {
   res.send(getMockSpot());
});


server.get('/mock/spot/:id', function(req, res) {
   var id = parseInt(req.params.id);
   console.log('getting mock spot data');
   res.send(getMockSpot(id));
});

server.get('/mock/model', function(req, res) {
   var id = parseInt(req.params.id);
   console.log('getting mock model data');
   res.send(getMockModel(id));
});

server.get('/mock/weather', function(req, res) {
   console.log('getting mock weather data');
   res.send(getMockWeather());
});


function getMockSpot(id) {
   var spotJson = 
{"results":[{"description":"Not sure if one can kite here","location":{"__type":"GeoPoint","latitude":37.5991,"longitude":-122.5158},"name":"San Francisco - China Camp","spotId":4,"wind_directions":["N","NW","NE"],"createdAt":"2013-03-10T18:37:55.521Z","updatedAt":"2013-03-10T21:23:23.289Z","objectId":"0uBXfcCKfn"},{"description":"Assateague","keywords":["sound","slicks","flats","marsh"],"location":{"__type":"GeoPoint","latitude":38.2235,"longitude":-75.149},"name":"AZT","spotId":2,"wind_directions":["SW","W","S"],"createdAt":"2013-02-02T16:42:17.363Z","updatedAt":"2013-03-11T03:34:39.974Z","objectId":"ku7jifajbS"},{"description":"Mexico Baja Penninsula","keywords":["beach","international","choppy"],"location":{"__type":"GeoPoint","latitude":24.0499,"longitude":-109.988},"name":"La Ventana","spotId":3,"wind_directions":["N","NE","E","SE"],"createdAt":"2013-02-02T16:48:17.043Z","updatedAt":"2013-03-11T03:34:38.882Z","objectId":"KmsGVqfsXW"},{"description":"Hatteras, Rodanthe","keywords":["sound","beach","slicks","flats","marsh"],"location":{"__type":"GeoPoint","latitude":35.594,"longitude":-75.4683},"name":"KHK","spotId":1,"wind_directions":["SW","NW","S","N"],"createdAt":"2013-02-02T16:40:16.266Z","updatedAt":"2013-03-11T03:34:46.005Z","objectId":"QjKJ5FELp3"}],"count":4};
   if (!id) {
      return spotJson;
   }
   //var json = JSON.parse(spotJson);
   for (i in spotJson.results) {
      var spot = spotJson.results[i];
      if (spot.spotId === id) {
         return spot;
      }
   }
   res.sendError('something happened bad');
};

function getMockModel() {
  var modelJson =  {
      "user" : "default",
      "name":"Standard Model",
      "description": "Delete me",	
   	"wind_low" : {"min": 8, "max": 15},	
   	"wind_med" : {"min": 16, "max": 25},	
   	"wind_high" : {"min": 26, "max": 35}
   };
   return modelJson;

};

function getMockWeather() {
   var weatherJson = {
      forecast : {
         hour0 : {
            wind : { direction : 'NW', 
                     speed : 15 }
         },
         hour1 : {
            wind : { direction : 'N', 
                     speed : 5 }
         },
         hour3 : {
            wind : { direction : 'NE', 
                     speed : 25 }
         },
         hour4 : {
            wind : { direction : 'NE', 
                     speed : 35 }
         },
         hour5 : {
            wind : { direction : 'N', 
                     speed : 5 }
         }
         ,
         hour6 : {
            wind : { direction : 'N', 
                     speed : 5 }
         }
      }
   }
   return weatherJson;
};
