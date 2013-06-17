(function($){

    var generating = false;
        

    $.fn.data_loader = function(settings) {   
        var $that = $(this);
        settings = $.extend(true, {}, $.fn.data_loader.settings, settings || {});

        console.log($that);
        
        return this.each(function() {
            var obj = $("<div></div>");
            obj.addClass('scroll-pane');
            
            $that.bind("scroll", function(e, b){
                var max_left = parseInt(this.scrollWidth) - parseInt(this.clientWidth);
                var cur_left = $(this).scrollLeft();
                if (generating === false && cur_left >= (max_left - (max_left * .4))) {
                    generating = true;
                    for (var i in _$local.spot_cache) {
                        for (var x in _$local.spot_cache[i]) {
                            if (x != $(this).attr('id')) {
                                continue;
                            }
                            var graph_objects = _$local.spot_cache_obj[i][x];
                            var spot_id = x;                            
                            var start = $(this).attr('data-last-point');
                            var end = parseInt($(this).attr('data-last-point')) + 32;
                            var max = parseInt($(this).attr('data-max-point'));
                            // we dont want to contine past max
                            if (start >= max) {
	                            return true;
                            }
                            $(this).data_loader.buildslide(_$local.spot_cache[i][x], $(this).attr('id'), start, end, graph_objects.timeline, graph_objects.winds);
                        }
                    }
                }
            });
        });
    }

    $.fn.data_loader.settings = {
        'per_slide': 5,
        'start': 0,
        'width': 100,
        'sensitivity': 10,
        'cache': []
    };

    $.fn.data_loader.buildslide = function(data, spot_id, start_spot, max_spots, graph_object, wind_object) {
		var y = [], z=[], x=[], i=0, pixel_width_length = 25, max_size=20, counter=0, min_size=1, top_padding=0, padding=4, gutter=20, position=0, radius=20, left_side=0, top_side=0, auto_load = false, window_width = $(window).width();
		if (_$local.spot_cache === undefined) {
			_$local.spot_cache = [];
		}
		if (!start_spot) {
			start_spot = 0;
		}
		if (!max_spots) {
			max_spots = 32;
		}
		x = data[0]; y = data[1]; z = data[2]; za = data[3]; xa = data[4];
		var picture_width = (pixel_width_length * parseInt(max_spots)) + 10;

		if (graph_object === undefined) {
			var b = Raphael(spot_id, picture_width, 120);
		} else {
			var b = graph_object;
			$(b.canvas).width(picture_width);
		}
		if (wind_object === undefined) {
    		var r = Raphael(spot_id, picture_width, 145);
		} else {
			var r = wind_object;
			$(r.canvas).width(picture_width);
		}

    	var height = 120, sleft=0, stop=0, width=0, left_position=0, padding = 2, top_padding = 20, x_width = 25, x_padding = 2, height = 60, start_position, circle, bar_height, starting_point = 100, bottom_padding = 12;
    	start_position = x_width - 10;
    	    	
		for (var i = start_spot; i < max_spots; i++) {
			if (max_spots !== "all" && counter >= max_spots) {
    			continue;
			}    		
    		obj_val = y[i];
    		
    		if (obj_val === undefined) {
	    		continue;
    		}
    		
    		bar_height = (parseInt(obj_val) * 4);
    		left_position = (x_width * i) + start_position;
			width = obj_val + (2 * parseInt(x_padding));
    		sleft = left_position;
    		stop = starting_point - ((parseInt(height) / 2) + (width / 2) + top_padding);
    		circle = r.rect(sleft, (starting_point - bar_height), x_width, bar_height);
    		if (obj_val >= 0 && obj_val <= 3) {
    			wind_color = "#99FFCC";
    		}
    		if (obj_val >= 3 && obj_val <= 4) {
    			wind_color = "#99FF00";
    		}
    		if (obj_val >= 5 && obj_val <= 7) {
    			wind_color = "#99CC00";
    		}
    		if (obj_val > 7 && obj_val <= 8) {
    			wind_color = "#FFFF00";
    		}
    		if (obj_val >= 9 && obj_val <= 12) {
    			wind_color = "#FFCC00";
    		}
    		if (obj_val >= 13 && obj_val <= 14) {
    			wind_color = "#FF3300";
    		}
    		if (obj_val >= 15) {
    			wind_color = "#000000";
    		}

	    	circle.attr("fill", wind_color);
			circle.attr("stroke", "none");	    		
			circle.data({
				"value": za[i].english +" MPG",
				"x": sleft,
				"y": stop,
				"r": obj_val,
				"w": x_width
			});
						
			var icon = b.getIcon("arrow-wind", {fill: wind_color});
			if (typeof z[i] !== 'undefined') {
				var degree = parseInt(z[i].degrees) + 180;
				icon.transform("t" + left_position + ",0r" + degree + "t0,0s.8");
				var text_direction = b.text(left_position + (x_width / 2), 45, z[i].dir);
				text_direction.transform("r-90");
			}
    		// Text (time)
    		if (typeof x[i] != 'undefined') {
	    		var txt_header = r.text(sleft+(x_width/2), 25, x[i]);
	    		txt_header.attr({'font':'10px Fontin-Sans, Arial', fill: '#000', stroker: 'none'});
	    		txt_header.rotate(-90, sleft+(x_width/2), 25);
    		}
    		if (xa[i] !== 'undefined') {
	    		if (xa[i].ampm == "AM" && xa[i].hour == "0") {
		    		var bar = r.rect((sleft-2), 0, 4, stop);
		    		bar.attr({fill: '#000'});
	    		}
    		}
    		var txt = r.text(sleft+(x_width/2), (starting_point + bottom_padding), obj_val);
    		txt.attr({'font':'12px Fontin-Sans, Arial', fill: '#000', stroker: 'none'});
    		var wind_speed = r.text(left_position + (x_width / 2), (starting_point - 20), za[i].english + " MPH");
    		wind_speed.attr({'font':'10px Fontin-Sans, Arial', fill: '#000', stroker: 'none'});
			wind_speed.transform("r-90");
    		position += width;
    		
			counter++;
		}
		
		generating = false;
		
		$("#" + spot_id + "-loader").remove();       		
		$("#" + spot_id).addClass("scroll-pane ui-widget ui-widget-header ui-corner-all").removeClass("hidden").attr('data-last-point', max_spots);
    }
    
})(jQuery);