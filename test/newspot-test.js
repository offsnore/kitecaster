var service = require('../services/KiteScoreService')
    , nconf = require('nconf')
    , colors = require('colors');

    nconf.argv().env().file({ file: require('path').resolve(__dirname, '../settings.json') });

    service.runIndividualSpotCache(78, function(err, response) {
        service.runSpotWeatherCache(78);
    });