
/*
 * GET mappings to views
 * Remember to keep this in alpabetic order (for comprehension's sake)
 */

exports.email = function(req, res){
   console.log('foobar');
};

exports.example = function(req, res){
  res.render('example', { title: 'Exampe Full Bootstrap page' });
};

exports.index = function(req, res){
  res.render('index', { title: 'Kitecaster' });
};

exports.spot = function(req, res) {
   console.log('spot api called'); 
   res.send('spot API called');
};

exports.start = function(req, res) {
   console.log('start url called'); 
   res.render('start', { title: 'Beta Start Page', body: 'You ready for this?' });
};

exports.test = function(req, res){
  res.render('test', { title: 'Test Page Demos' });
};






