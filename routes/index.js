
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Express' });
};

exports.test = function(req, res){
  res.render('test', { title: 'Test Page Demos' });
};

exports.example = function(req, res){
  res.render('example', { title: 'Exampe Full Bootstrap page' });
};