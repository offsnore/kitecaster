/*
   Session Finder Service - build 
*/

var restify = require('restify'),
    nconf = require('nconf'),
    validate = require('jsonschema').validate,
    Parse = require('kaiseki'),
    redis = require("redis"),
    //client = redis.createClient(),
    colors = require('colors'),
    async = require('async'),
    winston = require('winston'),
    _ = require('underscore'),
    moment = require('moment');

var app = module.exports;

app.buildSessionSearch = function(spot, scores, callback) {
  var spotId = spot.spotId;
  var scoresMap = {};
  var dayScoresMap = { 
     'spot_id' : spotId
  };
  var maxScore = 0;
  var maxScoreHour = 0;
  scores.forEach(function(score) {
     
/*      console.log('Iterating over score: ' + JSON.stringify(score)); */
     var dateStr = score.datestamp + score.timestamp;
     var date = moment(dateStr, "MM-DD-YYYYhh:mm a");
     var hour = parseInt(date.format("H"));
     //console.log('Hour: ' + hour);
     if (hour >= 7 && hour <= 21) {
        var scoreObj = {
           'hour' : hour,
           'score' : score.kiteScore
        }
        //console.log(JSON.stringify(scoreObj));
        if (dayScoresMap[score.datestamp] == null) {
         dayScoresMap[score.datestamp] = {};
        }
        dayScoresMap[score.datestamp][hour] = scoreObj;
        if (dayScoresMap[score.datestamp]['maxScore'] == null) {
           dayScoresMap[score.datestamp]['maxScore'] = {
              'score' : score.kiteScore,
              'hour'  : hour
           }
        }
        else if (score.kiteScore >  dayScoresMap[score.datestamp]['maxScore'].score ) {
           dayScoresMap[score.datestamp]['maxScore'] = {
              'score' : score.kiteScore,
              'hour'  : hour
           }
        };

     }
  });
  // iterate over all dates and calculate average
   for (var date in dayScoresMap) {
      var count = 0;
      var scoreSum = 0;
      var scores = dayScoresMap[date];
      for (var hour in scores) {
         var hour = parseInt(hour);
         if ( isNaN(hour) === false) {;
            scoreSum += scores[hour].score;
            count++;

         }
      }
      var avg =  ( scoreSum / count);
      dayScoresMap[date]['average'] = avg;      
   }   
   callback(null, dayScoresMap);
};

//var date = moment("07-28-201310:00 PM");

var testSpot = {
   spotId: "1"
}

var testScores = [ 
   {
   epoch: "1375466800",
   wdir: "210",
   wspd: 19,
   temp_c: "25",
   temp_f: "77",
   icon_url: "http://icons-ak.wxug.com/i/c/k/nt_tstorms.gif",
   wdir_compass: "SSW",
   timestamp: "3:00 PM",
   ampm: "PM",
   datestamp: "07-28-2013",
   closest_spot_direction_degrees: 225,
   closest_spot_direction: "SW",
   kiteScore: 7,
   lastUpdated: "Mon, 29 Jul 2013 02:02:21 GMT",
   kitescore_subtraction: 0.3333333333333333
   },
   {
   epoch: "1375066800",
   wdir: "210",
   wspd: 19,
   temp_c: "25",
   temp_f: "77",
   icon_url: "http://icons-ak.wxug.com/i/c/k/nt_tstorms.gif",
   wdir_compass: "SSW",
   timestamp: "8:00 AM",
   ampm: "PM",
   datestamp: "07-28-2013",
   closest_spot_direction_degrees: 225,
   closest_spot_direction: "SW",
   kiteScore: 7,
   lastUpdated: "Mon, 29 Jul 2013 02:02:21 GMT",
   kitescore_subtraction: 0.3333333333333333
   },
   {
   epoch: "1375070400",
   wdir: "210",
   wspd: 18,
   temp_c: "26",
   temp_f: "78",
   icon_url: "http://icons-ak.wxug.com/i/c/k/nt_tstorms.gif",
   wdir_compass: "SSW",
   timestamp: "4:00 PM",
   ampm: "PM",
   datestamp: "07-28-2013",
   closest_spot_direction_degrees: 225,
   closest_spot_direction: "SW",
   kiteScore: 2,
   lastUpdated: "Mon, 29 Jul 2013 02:02:21 GMT",
   kitescore_subtraction: 0.3333333333333333
   },
   {
   epoch: "1375070400",
   wdir: "210",
   wspd: 18,
   temp_c: "26",
   temp_f: "78",
   icon_url: "http://icons-ak.wxug.com/i/c/k/nt_tstorms.gif",
   wdir_compass: "SSW",
   timestamp: "11:00 AM",
   ampm: "PM",
   datestamp: "07-28-2013",
   closest_spot_direction_degrees: 225,
   closest_spot_direction: "SW",
   kiteScore: 3,
   lastUpdated: "Mon, 29 Jul 2013 02:02:21 GMT",
   kitescore_subtraction: 0.3333333333333333
   },
      {
   epoch: "1375070400",
   wdir: "210",
   wspd: 18,
   temp_c: "26",
   temp_f: "78",
   icon_url: "http://icons-ak.wxug.com/i/c/k/nt_tstorms.gif",
   wdir_compass: "SSW",
   timestamp: "2:00 PM",
   ampm: "PM",
   datestamp: "07-28-2013",
   closest_spot_direction_degrees: 225,
   closest_spot_direction: "SW",
   kiteScore:4,
   lastUpdated: "Mon, 29 Jul 2013 02:02:21 GMT",
   kitescore_subtraction: 0.3333333333333333
   },
   {
   epoch: "1375070400",
   wdir: "210",
   wspd: 18,
   temp_c: "26",
   temp_f: "78",
   icon_url: "http://icons-ak.wxug.com/i/c/k/nt_tstorms.gif",
   wdir_compass: "SSW",
   timestamp: "2:00 PM",
   ampm: "PM",
   datestamp: "07-29-2013",
   closest_spot_direction_degrees: 225,
   closest_spot_direction: "SW",
   kiteScore:5,
   lastUpdated: "Mon, 29 Jul 2013 02:02:21 GMT",
   kitescore_subtraction: 0.3333333333333333
   },
   {
   epoch: "1375070400",
   wdir: "210",
   wspd: 18,
   temp_c: "26",
   temp_f: "78",
   icon_url: "http://icons-ak.wxug.com/i/c/k/nt_tstorms.gif",
   wdir_compass: "SSW",
   timestamp: "2:00 PM",
   ampm: "PM",
   datestamp: "07-30-2013",
   closest_spot_direction_degrees: 225,
   closest_spot_direction: "SW",
   kiteScore:6,
   lastUpdated: "Mon, 29 Jul 2013 02:02:21 GMT",
   kitescore_subtraction: 0.3333333333333333
   },
   {
   epoch: "1375070400",
   wdir: "210",
   wspd: 18,
   temp_c: "26",
   temp_f: "78",
   icon_url: "http://icons-ak.wxug.com/i/c/k/nt_tstorms.gif",
   wdir_compass: "SSW",
   timestamp: "5:00 PM",
   ampm: "PM",
   datestamp: "07-30-2013",
   closest_spot_direction_degrees: 225,
   closest_spot_direction: "SW",
   kiteScore:14,
   lastUpdated: "Mon, 29 Jul 2013 02:02:21 GMT",
   kitescore_subtraction: 0.3333333333333333
   },
   {
   epoch: "1375070400",
   wdir: "210",
   wspd: 18,
   temp_c: "26",
   temp_f: "78",
   icon_url: "http://icons-ak.wxug.com/i/c/k/nt_tstorms.gif",
   wdir_compass: "SSW",
   timestamp: "3:00 PM",
   ampm: "PM",
   datestamp: "07-30-2013",
   closest_spot_direction_degrees: 225,
   closest_spot_direction: "SW",
   kiteScore:13,
   lastUpdated: "Mon, 29 Jul 2013 02:02:21 GMT",
   kitescore_subtraction: 0.3333333333333333
   }
];

/**
app.buildSessionSearch(testSpot, testScores, function(err, results){
   console.log('Ran session search building on test spot and dummy data. Got Result, wooeey!!');
   //console.log(JSON.stringify(results));
});
**/

