#!/bin/sh

forever stopall

forever start server.js
forever start api/kites.js
forever start api/kitescore.js
forever start services/KiteScoreApp.js
forever start api/user.js
forever start api/spot.js
forever start frontend/server.js
forever start crons/graph_images.js
forever start crons/jenny_forecaster.js

echo "finished starting services..";

