(function($){

    var generating = false;
        

    $.fn.data_loader = function(settings) {   
        var $that = $(this);
        settings = $.extend(true, {}, $.fn.data_loader.settings, settings || {});
        
        return this.each(function() {
            var obj = $("<div></div>");
            obj.addClass('scroll-pane');
            
            $that.bind("scroll", function(e, b){
                var max_left = parseInt(this.scrollWidth) - parseInt(this.clientWidth);
                var cur_left = $(this).scrollLeft();
                if (generating === false && cur_left >= (max_left - (max_left * .4))) {
                    generating = true;
                    if (_$local.spot_cache_obj.length != _$local.spot_cache.length) {
	                    for (var i in _$local.spot_cache) {
	                        for (var x in _$local.spot_cache[i]) {
	                            if (x != $(this).attr('id')) {
	                                continue;
	                            }
	                            for (y in _$local.spot_cache_obj) {
	                            	if (typeof _$local.spot_cache_obj[y][x] == 'undefined') {
		                            	continue;
	                            	}
		                            var graph_objects = _$local.spot_cache_obj[y][x];
	                            }
	                            var spot_id = x;                            
	                            var start = $(this).attr('data-last-point');
	                            var end = parseInt($(this).attr('data-last-point')) + 96;
	                            var max = parseInt($(this).attr('data-max-point'));
	                            // we dont want to contine past max
	                            if (start >= max) {
		                            return true;
	                            }
	                            console.log(start);
	                            $(this).data_loader.buildslide(_$local.spot_cache[i][x], $(this).attr('id'), start, end, graph_objects.timeline, graph_objects.winds);
	                        }
						}
                    } else {
	                    for (var i in _$local.spot_cache) {
	                        for (var x in _$local.spot_cache[i]) {
	                            if (x != $(this).attr('id')) {
	                                continue;
	                            }
	                            var graph_objects = _$local.spot_cache_obj[i][x];
	                            var spot_id = x;                            
	                            var start = $(this).attr('data-last-point');
	                            var end = parseInt($(this).attr('data-last-point')) + 96;
	                            var max = parseInt($(this).attr('data-max-point'));
	                            // we dont want to contine past max
	                            if (start >= max) {
		                            return true;
	                            }
	                            $(this).data_loader.buildslide(_$local.spot_cache[i][x], $(this).attr('id'), start, end, graph_objects.timeline, graph_objects.winds);
	                        }
	                    }	                    
                    }
                }
            });
        });
    }

    $.fn.data_loader.reset = function() {
	    _$local.spot_cache = [];
		_$local.spot_cache_obj = [];
    }
    
    $.fn.data_loader.reload = function(spot_id) {
	    return this.each(function(){
			if (_$local.spot_cache === undefined) {
				_$local.spot_cache = [];
			}
			if (_$local.spot_cache_obj === undefined) {
				_$local.spot_cache_obj = [];
			}
    		$("#" + spot_id + ".scroll-pane").data_loader();	    		
	    });
    }

    $.fn.data_loader.settings = {
        'per_slide': 5,
        'start': 0,
        'width': 100,
        'sensitivity': 10,
        'cache': []
    };
    
    $.fn.data_loader.build_cache_tables = function(spot_id) {
	    if (typeof _$local.spot_cache_obj === 'undefined') {
		    _$local.spot_cache_obj = [];
	    }
	    if (typeof _$local.spot_cache === 'undefined') {
		    _$local.spot_cache = [];
	    }
	    
	    for(var x in _$local.spot_cache_obj) {
	    	for (var z in _$local.spot_cache_obj[x]) {
	    		if (spot_id != z) {
		    		continue;
	    		}
	    		_$local.spot_cache_obj.splice(x, 1);
	    	}
	    }

	    for(var x in _$local.spot_cache) {
	    	for (var z in _$local.spot_cache[x]) {
	    		if (spot_id != z) {
		    		continue;
	    		}
	    		_$local.spot_cache.splice(x, 1);
	    	}
	    }
    }
    
    $.fn.data_loader.parse_set = function(data, sub_set) {
	    for (var i in data) {
	    	var counter = 0;
	    	for (var z=0; z < data[i].length; z++) {
		    	if (counter < sub_set) {
		    		data[i].splice(z, 1);
		    		counter = 0;
		    	}
		    	counter++;
	    	}
	    }
	    return data;
    };

    $.fn.data_loader.buildslide = function(data, spot_id, start_spot, max_spots, graph_object, wind_object) {
		var y = [], z=[], x=[], i=0, pixel_width_length=25, max_size=20, initial=false, absolute_max_spots=168, counter=0, min_size=1, top_padding=0, padding=4, gutter=20, position=0, radius=20, left_side=0, top_side=0, auto_load = false, window_width = $(window).width();

		// clears out the cache for this spot_id
		this.build_cache_tables(spot_id);

		var cache_obj = {};
		cache_obj[spot_id] = data;			
		_$local.spot_cache.push(cache_obj);

		if (!start_spot) {
			start_spot = 0;
		}
		if (!max_spots) {
			max_spots = 108;
		}

		var sub_set = 4;

		var data = this.parse_set(data, sub_set);

		x = data[0]; y = data[1]; z = data[2]; za = data[3]; xa = data[4];
		var picture_width = ((pixel_width_length * parseInt(max_spots)) / sub_set) + 10;
		
		if (graph_object === undefined) {
			var b = Raphael(spot_id, picture_width, 120);
			initial = true;
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

		var spot_cache_obj = {};
		spot_cache_obj[spot_id] = {};
		spot_cache_obj[spot_id]['timeline'] = b;
		spot_cache_obj[spot_id]['winds'] = r;
		_$local.spot_cache_obj.push(spot_cache_obj);

    	var height = 120, sleft=0, stop=0, width=0, left_position=0, padding = 2, top_padding = 20, x_width = 25, x_padding = 2, height = 60, start_position, circle, bar_height, starting_point = 100, bottom_padding = 12, counter = 0;
    	start_position = x_width - 10;

		for (var zx = start_spot; zx < max_spots; zx++) {
			if (max_spots !== "all" && counter >= max_spots) {
    			continue;
			}
			i = counter;
    		obj_val = y[i];
    		
    		if (obj_val === undefined) {
	    		continue;
    		}
    		
    		bar_height = (parseInt(obj_val) * 4);
    		left_position = (x_width * zx) + start_position;
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
	    		if (xa[i].ampm == "AM" && xa[i].hour == "0" || xa[i].ampm == "PM" && xa[i].hour == "1") {
		    		var bar = r.rect((sleft-2), 0, 4, stop);
		    		bar.attr({fill: '#000'});
	    		}
	    		if (xa[i].ampm == "AM" && parseInt(xa[i].hour) < 6 || xa[i].ampm == "PM" && parseInt(xa[i].hour) > 19) {
//		    		var bar = r.rect(sleft, (starting_point - bar_height), x_width, bar_height);
		    		var bar = r.rect(sleft, 0, x_width, starting_point);
		    		bar.attr({fill: '#A4A4A4', stroke: 'none', 'opacity': .5});
	    		}
    		}
    		var txt = r.text(sleft+(x_width/2), (starting_point + bottom_padding), obj_val);
    		txt.attr({'font':'12px Fontin-Sans, Arial', fill: '#000', stroker: 'none'});
    		var wind_speed = r.text(left_position + (x_width / 2), (starting_point - 20), za[i].english + " MPH");
    		wind_speed.attr({'font':'10px Fontin-Sans, Arial', fill: '#000', stroker: 'none'});
			wind_speed.transform("r-90");
    		position += width;
//	    	counter = (parseInt(counter) + 3);	
	    	counter++;	
		}
		
		generating = false;
		
		var obj = $("#" + spot_id);
		
		$("#" + spot_id + "-loader").remove();
		obj.addClass("scroll-pane ui-widget ui-widget-header ui-corner-all").removeClass("hidden").attr('data-last-point', max_spots);

		if (initial) {
			obj.attr('data-max-point', absolute_max_spots);
		}

		$("#" + spot_id + ".scroll-pane").data_loader();
    }
    
})(jQuery);