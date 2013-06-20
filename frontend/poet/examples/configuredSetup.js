var
  express  = require( 'express' ),
  moment   = require( 'moment' ),
  app      = express(),
  poet     = require( '../lib/poet' )( app );

poet.set({
  postsPerPage : 3,
  posts        : require('path').resolve(__dirname, './_newposts'),
  metaFormat   : 'json'
}).createPostRoute( '/:post.html', 'post' )
  .createSitemapRoute('/sitemap.xml')
  .createPageRoute( '/pagination/:page', 'page' )
  .createTagRoute( '/mytags/:tag', 'tag' )
  .createCategoryRoute( '/mycategories/:category', 'category' )
  .init();

app.set( 'view engine', 'jade' );
app.set( 'views', __dirname + '/views' );
app.use( express.static( require('path').resolve(__dirname) + '/public' ));
app.use( app.router );

app.get( '/services.html', function(req, res) {
    res.render('services');
});

app.get( '/blog.html', function(req, res) {
    res.render('blog');
});

app.get( '/', function ( req, res ) { 
    res.render( 'index' ) 
});

app.use(function(req, res, next){
    res.status(404);
    res.redirect("/");    
});

app.listen( 3000 );
