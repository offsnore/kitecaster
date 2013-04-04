(function($){
	$.fn.widgetFeed = function() {
		var that = $(this);
		that.html("loaded content via API");
	}
	$.fn.widgetOther = function() {
		var that = $(this);
		that.html("loaded content via API");
	}
	// do a quick loader, check for widgets existance
	$(document).ready(function($){
		if (typeof $(".widget.feed")[0] != 'undefined') {
			var that = $(".widget.feed");
			that.widgetFeed();
		}
	});
})(jQuery)