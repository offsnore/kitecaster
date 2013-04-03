
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
   res.render('start', { title: 'kitecaster - beta', body: 'You ready for this?', scripts: ['js/lib/jquery.js', 'js/lib/underscore.js'] });
};

exports.test = function(req, res){
  res.render('test', { title: 'Test Page Demos' });
};

// First Page for Application
// @purpose Added in Dynamic Content from NodeJS to Jade Template Wrapper
exports.main = function(req, res) {
	var params = {
		title: "kitecaster - beta",
		credits: "testing",
		body: {
			content: {
				pageinfo: "first entry into page"
			}
		}
	}
	res.render('main', params);

/**
   res.render('main', { 
   	title: 'kitecaster - beta', 
   	body: 'First page of Application!',
   	content: 'testing yo', 
   	scripts: 
   		['js/lib/jquery.js', 'js/lib/underscore.js'] 
   	});
*/
};




