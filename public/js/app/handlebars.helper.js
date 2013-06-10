(function(Handlebars){
	Handlebars.registerHelper("ifCond", function(obj, v1, v2, fn) {
	    if (v1 && v2) {
	        if (v1 == v2) {
	            return fn(obj);
	        }
	    }
	    return null;
	});

    /**
     * If Equals
     * if_eq this compare=that
     */
    Handlebars.registerHelper('if_eq', function(context, options) {
        if (context == options.hash.compare)
            return options.fn(this);
        return options.inverse(this);
    });

})(Handlebars)
