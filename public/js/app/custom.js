// Custom Handler used to Handle Custom Calls and functionality
(function($){	

    window._$session_id = false;
    window._$user_id = false;
    window._$userId = false; // I hate this @todo Make all user _user_id
    window._$spot_url = false;
    window._$spot_id = false;
    
    window.setVariables = function() {
        var x, y, _args;
        _args = arguments;
        for (x in _args) {
            for (y in _args[x]) {
                window[y] = _args[x][y];
            }
        }
    }

	if (typeof _$local == 'undefined') {
		_$local = {
			load_spot: false,
			discover_nearby: false,
			discover_radius: 100,
			mapzoom: 11,
			spot: {},
			map: {},
			geolocal: {},
			getGeolocation: function(){},
			returnGeolocation: function(){},
			parseGeoFormat: function(){},
			pullGeolocation: function(){}
		};

		// Handles getting distance between Spot Location and You (or a 2nd spot i suppose), defaults to miles
		_$local.getDistanceFrom = function(lat1, lon1, lat2, lon2, type) {
			if (!type) {
				var type = "miles";
			}
			var lat1 = lat1.toRad(); var lat2 = lat2.toRad();
			var lon1 = lon1.toRad(); var lon2 = lon2.toRad();
			var R = (type == "km") ? 6371 : 3959;
			var d = Math.acos(Math.sin(lat1)*Math.sin(lat2) + Math.cos(lat1)*Math.cos(lat2) * Math.cos(lon2-lon1)) * R;
			return ((d > 0) ? d.toFixed(0) : 0) + " " + type;
		}

		function detectBrowser() {
			var useragent = navigator.userAgent;
			var mapdiv = document.getElementById("map-canvas");
			if (useragent.indexOf('iPhone') != -1 || useragent.indexOf('Android') != -1 ) {
				mapdiv.style.width = '100%';
				mapdiv.style.height = '100%';
			}
		}

		// GeoLocation Stuff
		_$local.geolocal = {};
		_$local.getGeolocation = function(callback) {
			if (typeof _$session_id == 'undefined') {
				return false;
			}
			// @todo - check for new Location
			var url = "/user/location?userObjectId=" + encodeURIComponent(_$session_id);
			// lets check our DB first
			$.getJSON(url, function(data){
				if (data.length > 0) {
					var data = data[0];
					_$local.geolocal = data;
					_$local.parseGeoFormat(data);
					if (typeof callback == 'function') {
						callback(data);
					}
				} else {
					_$local.pullGeolocation();
				}
			});
		}
		
		_$local.returnGeolocation = function() {
			if (_$local.geolocal.length == 0) {
				return _$local.getGeolocation(function(data){
					return $data; // geolocal before being set
				});
			} else {
				return _$local.geolocal;				
			}
		}
		
		_$local.parseGeoFormat = function(data) {
			var location;
			if (typeof data.results != 'undefined') {
				location = data.results[0].formatted_address;
			} else {
				location = data.street;
			}
			$(".location_description").html(location+" ");
		}
		
		_$local.pullGeolocation = function(callback) {
			if (typeof callback == 'undefined') {
    			var callback = function(){};
			}
				// attempt w Html5 first
			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(function(geo){
					var lat = geo.coords.latitude;
					var lon = geo.coords.longitude;
					var latlong = parseFloat(lat).toFixed(4) + ", " + parseFloat(lon).toFixed(4);
					var url = "//maps.googleapis.com/maps/api/geocode/json?latlng=" + lat + "," + lon + "&sensor=true";
					$.getJSON(url, function(data){
						_$local.parseGeoFormat(data);
						var location = data.results[0].formatted_address;
						_$local.geolocal = data.results[0];
						$.ajax({
							url: '/user/location',
							type: 'PUT',
							dataType: "json",
							data: JSON.stringify({
								userObjectId: _$session_id,
								lat: parseFloat(lat),
								lon: parseFloat(lon),
								street: location
							}),
							success: function() {
    							callback();
							}
						});
					});
				});
			} else {
				$(".location_description").html("<p class='alert'>It seems we can't verify your location. <br /><input type='text' placeholder='Please enter a nearby city name or zipcode....' id='nearby_search' class='input-block-level nearby_search' /></p>");
				typeahead_register();
			}
		}
		
		_$local.mapfunc = {};
		_$local.map = {};
		_$local.mapmarkers = [];
		
		_$local.mapfunc.buildinfo = function(content) {
    		var a = jQuery("<div></div>");
    		return a.html();
		}
		
		_$local.mapfunc.formatinfowindow = function(object) {
    		var obj, source, template;
			obj = $("#spots-infowindow");
			source = obj.html();
			template = Handlebars.compile(source);
			return template(object);
		}
		
		_$local.mapfunc.updatemarkerinfo = function(spotId, state) {
			var x;
			if (!state) {
				var state = false;
			}			
			for (x in _$local.mapmarkers) {
				if (_$local.mapmarkers[x].spotId != spotId) {
					continue;
				}
				_$local.mapmarkers[x].spotObj.subscribed = state;
				_$local.mapmarkers[x].myHtmlContent = _$local.mapfunc.formatinfowindow(_$local.mapmarkers[x].spotObj);
			}
		}
		
		_$local.mapfunc.addmarker = function(lat, lon, html, blue, spotId, obj) {
		    if (!blue) {
    		    var blue = "blue";
		    }
		    if (!spotId) {
			    var spotId = false;
		    }
		    if (!obj) {
			    var obj = false;
		    }
    		var infowindow = new google.maps.InfoWindow({
        		content: html,
        		maxWidth: 200
    		});
    		var marker = new google.maps.Marker({
        		position: new google.maps.LatLng(lat, lon),
				icon: 'http://www.google.com/intl/en_us/mapfiles/ms/micons/' + blue + '-dot.png',
        		map: _$local.map     		
    		});
    		_$local.mapmarkers.push(marker);
    		// custom markers so we can update the Content Dynamically
    		marker.myHtmlContent = html;
    		marker.spotId = spotId;
    		marker.spotObj = obj;
    		google.maps.event.addListener(marker, 'click', function() {
    			infowindow.setContent(marker.myHtmlContent);
        		infowindow.open(_$local.map, marker);
    		});
		}
		
		_$local.initializeGeomap = function(lat, lon) {
			var lat = lat;
			var lon = lon;

			if (!lat && !lon) {
				return false;
			}

			$("#lat").val(lat);
			$("#lon").val(lon);

			detectBrowser();

			function initialize() {
				var map = new google.maps.Map(
					document.getElementById('map-canvas'), {
					center: new google.maps.LatLng(lat, lon),
					zoom: _$local.mapzoom,
					mapTypeId: google.maps.MapTypeId.ROADMAP
				});	
				_$local.map = map;
				var marker = new google.maps.Marker({
					position: new google.maps.LatLng(lat, lon),
					map: map
				});
				google.maps.event.addListener(map, 'click', function(event){
					var latlong = parseFloat(event.latLng.lat()).toFixed(4) + ", " + parseFloat(event.latLng.lng()).toFixed(4);
					var url = "//maps.googleapis.com/maps/api/geocode/json?latlng=" + event.latLng.lat() + "," + event.latLng.lng() + "&sensor=false";
					$.ajax({
						url: url,
						dataType: "json",
						beforeSend: function() {
							$(".search-query").val("Loading..");
						},
						success: function(data){
                            if (typeof data.results[1] == 'undefined') {
                              return false;
                            }
							var addy = data.results[1].formatted_address;
							//console.log(data.results);
							//var address = addy[1].short_name + ", " + addy[2].short_name;
							$(".search-query").val(addy);
						},
						error: function() {
							$(".search-query").val("Something went wrong :( .. try again.");
						}
					});
					$("#lat").val(event.latLng.lat());
					$("#lon").val(event.latLng.lng());
					$(".latlon").text(latlong);
				});
			}
			jQuery(document).ready(function(){
				if (typeof google != 'undefined') {
					initialize();					
				}
			});
		}

	}

	$(document).ready(function($){

		if (typeof $("#profile-form")[0] != 'undefined') {
			$('#profile-form').validate({
				rules: {
					name: {
						minlength: 2,
						required: true
					},
					lastname: {
						minlength: 2,
						required: true
					},
					// @todo, check for existing emails
					email: {
						required: true,
						email: true
					},
					weight: {
						minlength: 2,
						digits: true,
						required: true
					}
				},
				highlight: function(element) {
					$(element).closest('.control-group').removeClass('success').addClass('error');
				},
				success: function(element) {
					element
					.text('OK!').addClass('valid')
					.closest('.control-group').removeClass('error').addClass('success');
				}
			});
		}
		
		function formatInfoWindow(object) {
    		var obj, source, template;
			obj = $("#spots-infowindow");
			source = obj.html();
			template = Handlebars.compile(source);
			return template(object);
		}

		function loadGraphic(spotId, data_input) {

			var xs = [], ys = [];
			for (i=0; i < data_input[0].length; i++) {
				xs.push(i);
				ys.push(0);
			}
			for (var i = 0; i < data_input[1].length; i++) {
				data_input[1][i] = ( data_input[1][i] < 0  ? 0 : data_input[1][i] );
			}
			var r = Raphael(spotId),
			data  = data_input[1],
			axisy = ["", ""],
			axisx = data_input[0];

			console.log(r, spotId);

			r.dotchart(0, 0, 620, 60, xs, ys, data, {
				symbol: "o", 
				max: 15,
				gutter: 10,
				heat: false, 
				axis: "1 0 0 0", 
				axisxstep: 23, 
				axisystep: 20,
				axisxlabels: axisx, 
				axisxtype: " ", 
				axisytype: " ", 
				axisylabels: axisy
			}).each(function() {
			}).hover(function () {
				this.marker = this.marker || r.tag(this.x, this.y, this.value, 0, this.r + 4).insertBefore(this);
				this.marker.show();
			}, function () {
				this.marker && this.marker.hide();
			});
			
			$(r.canvas).css("height", "60");
		};

		$.fn.serializeObject = function() {
		    var o = {};
		    var a = this.serializeArray();
		    $.each(a, function() {
		        if (o[this.name] !== undefined) {
		            if (!o[this.name].push) {
		                o[this.name] = [o[this.name]];
		            }
		            o[this.name].push(this.value || '');
		        } else {
		            o[this.name] = this.value || '';
		        }
		    });
		    return o;
		};

		function loadWindCondition(direction) {
			$(".wind_direction").each(function(i, item){
				if ($(item).val() == direction) {
					$(item).addClass("active");
				}
			});
		}

		function loadWindConditions() {
			if (typeof window._$winds != 'undefined') {
				var winds = window._$winds;
				for (var x in winds) {
					loadWindCondition(winds[x]);
				}
			}
		}

		function parseKiteScore(data) {
			var output = jQuery("<div></div>");
			$(data).each(function(i, obj){
				var a = jQuery("<p>");
				a.html(obj.time.civil + " - KiteScore: " + obj.kiteScore);
				output.append(a);
			});
			return output;
		}

		// Easy method for a Call to nearby Spots
		function loadnearby() {
			if (typeof _$local.map != 'undefined') {
				$.ajax({
					url: '/spot/' + _$spot_id + "?discover=true",
					datatype: "json",
					success: function(data){
						$(data).each(function(i, item){
							_$local.map.loadSpots(item.location.latitude, item.location.longitude, item.name);
						});
					}
				});
			}
		}
		
		function parseForGraph(data) {
			var x = [];
			var y = [];
			$(data).each(function(i, item){
			     // One Forecasting System
			     if (typeof item.time !== 'undefined') {
    			     x.push(item.time.civil);
			     }
			     // Data from another forecasting system
			     if (typeof item.FCTTIME !== 'undefined') {
    			     x.push(item.FCTTIME.civil);
			     }
				y.push(item.kiteScore);
			});
			return [x,y];
		}
				
		function newGraphic(spot_id, data) {
			var y = [], x=[], i=0, max_size=20, min_size=1, top_padding=0, padding=4, gutter=20, position=0, radius=20, left_side=0, top_side=0;

			x = data[0];
			y = data[1];

    		var r = Raphael(spot_id, 680, 145);

    		var height = 120, sleft=0, stop=0, width=0, left_position=0;
    		padding = 2;
    		top_padding = 20;
    		
    		var x_width = 25;
    		var x_padding = 2;
    		var height = 60;
    		var start_position = x_width - 10;
    		
    		for (i in y) {
	    		obj_val = y[i];
	    		var bar_height = (parseInt(obj_val) * 4);
	    		left_position = (x_width * i) + start_position;
    			width = obj_val + (2 * parseInt(x_padding));
	    		sleft = left_position;
	    		stop = (parseInt(height) / 2) - (width / 2) + top_padding;	    		
	    		var circle = r.rect(sleft, height, x_width, bar_height);
	    		if (obj_val >= 0 && obj_val <= 5) {
	    			circle.data("highlight-text", "#fff");
	    			circle.data("highlight-fill", "#000");
		    		circle.attr("fill", "#99FFCC");
	    		}
	    		if (obj_val > 5 && obj_val <= 8) {
	    			circle.data("highlight-text", "");
	    			circle.data("highlight-fill", "");
		    		circle.attr("fill", "#FFFF00");
	    		}
	    		if (obj_val >= 9 && obj_val <= 12) {
	    			circle.data("highlight-text", "");
	    			circle.data("highlight-fill", "");
		    		circle.attr("fill", "#FFCC00");
	    		}
	    		if (obj_val >= 13 && obj_val <= 14) {
	    			circle.data("highlight-text", "");
	    			circle.data("highlight-fill", "");
		    		circle.attr("fill", "#FF3300");
	    		}
	    		if (obj_val >= 15) {
	    			circle.data("highlight-text", "");
	    			circle.data("highlight-fill", "");
		    		circle.attr("fill", "#000000");
	    		}
	    		circle.attr("stroke", "none");	    		
	    		circle.data({
	    			"value": obj_val,
	    			"x": sleft,
	    			"y": stop,
	    			"r": obj_val,
	    			"w": x_width
	    		});
	    		var c2 = r.circle(sleft+(x_width/2), height, 10);
	    		c2.attr('fill', '#000');
	    		c2.attr('color', '#FFF');
	    		
	    		if (typeof x[i] != 'undefined') {
		    		var txt_header = r.text(sleft+(x_width/2), 25, x[i]);
		    		txt_header.attr({'font':'10px Fontin-Sans, Arial', fill: '#000', stroker: 'none'});
		    		txt_header.rotate(-90, sleft+(x_width/2), 25);
	    		}
	    		
	    		var txt = r.text(sleft+(x_width/2), height, obj_val);
	    		txt.attr({'font':'10px Fontin-Sans, Arial', fill: '#fff', stroker: 'none'});
	    		circle.hover(function() {
//		    		this.marker = this.marker || r.label(this.data('x') + (this.data('w') / 2), this.data('y') - 14, this.data('value')).insertBefore(this);
//		    		this.marker.show();
	    		}, function(){
//		    		this.marker && this.marker.hide();
	    		});
	    		position += width;
    		}
    		$("#" + spot_id + "-loader").remove();
    		$("#" + spot_id).removeClass("hidden");
		}
		
		function loadKitescore(spot_id, override_id) {
			var spot = spot_id || _$spot_id;
			if (!spot) {
				return false;
			}
			
			var url = "http://" + _$spot_url + "/score/7day/" + spot;
			var parent = "spot-" + spot;
			$.ajax({
				type: "GET",
				dataType: "json",				
				url: url,
				error: function() {
					var spot_id = "kitegraph-" + spot;
    				$("#" + spot_id).html("Kitescore for this spot is unavailable at the moment.");
    				$("#" + spot_id + "-loader").remove();
				},
				success: function(data) {
					var graphId = parent + "-graph";
					if (override_id) {
						var graphId = override_id;
					}
					var d = parseForGraph(data);
					var spot_id = "kitegraph-" + spot;
					newGraphic(spot_id, d);
/**
					var graph = jQuery("<div></div>").attr('id', graphId);
					//var title = jQuery("<h3></h3>").text("KiteScore (Kite Ability of This Spot)");
					if (override_id) {
						$(override_id).html("");
						$(parent).find(".loader").remove();
					} else {
						//$(parent).append(title);						
					}
					$(parent).append(graph);
					loadGraphic(graphId, d);
**/
				}
			})			
		}

		// Easy method for a Call to Weather Forecast
		function loadForecast(spot_id) {
			var spot = spot_id || _$spot_id;
				
			if (!spot) {
				return false;
			}
			
			var url = "http://" + _$spot_url + "/checkin/weather/" + spot;
			var parent = "#spot-" + spot;
			$.ajax({
				type: 'GET',
				dataType: "json",
				data: {
					userId: _$user_id
				},
				url: url,
				success: function(data) {
					var current_forecast = {};
					if (data) {
						/* wunder
						var current_forecast = data.simpleforecast.forecastday[0];								
						current_forecast.details = data.txt_forecast.forecastday[0].fcttext;
						current_forecast.google_image_url = data.google_image_url;
						*/
						
						// forecast.io revise
						
						var current_forecast = data.currently;
						current_forecast.details = data.currently.summary;
						current_forecast.google_image_url = data.icon; // need to map the options to a url! i.e. 
						/*
   						icon: A machine-readable text summary of this data point, suitable for selecting an icon for display. If defined, this property will have one of the following values: clear-day, clear-night, rain, snow, sleet, wind, fog, cloudy, partly-cloudy-day, or partly-cloudy-night. (Developers should ensure that a sensible default is defined, as additional values, such as hail, thunderstorm, or tornado, may be defined in the future.)
   						
						*/
					}
					var obj = $("#spotweather-template");
					var source = obj.html();
					var template = Handlebars.compile(source);
					$(".active_weather", parent).html(template(current_forecast));
				}, 
				error: function() {
					$(".active_weather", parent).html("Current weather unavailable at the moment.");
				}
			});					
		}


		$("div.btn-group input[type='button']").click(function(){
			var hidden_label = $(this).attr('name').toString().split("_")[1];
			//console.log(hidden_label, $(this).attr('id'));
			$("#" + hidden_label).attr("value", $(this).attr('id'));
		});
		$("div.btn-group input[type='button']").click(function(){
			//$("")
		});
		var default_value = 150;
		if (typeof $("#travel_distance")[0] != 'undefiend') {
			var default_value = $("#travel_distance").val();
		}
		if ($.fn.slider) {
			$(".distance").slider({
			    orientation: "horizontal",
			    range: "min",
			    min: 0,
			    max: 1000,
			    step: 50,
			    value: parseInt(default_value),
			    slide: function (event, ui) {
			    	var value = (ui.value < 1 ? "1" : ui.value);
			    	$("#travel_distance").val(value);
			    	if (value >= 1000) {
				    	value = "238,900";
				    	$(".distance .measurement").html("Miles. (So like between here and the moon.)");
				    	$("#travel_distance").val(-1);
			    	} else {
				    	$(".distance .measurement").html("Miles");
			    	}
			        $(".distance .echo").html(value);
			    }
			});
			var default_value = $(".distance").slider("value");
			$("#travel_distance").val(default_value);
			$(".distance .echo").html(default_value);
		}

		// Logic To Handle Spitting out the Spot Themselves		
		if (typeof _$spot_url != 'undefined') {
			if (typeof $("#spots-old-template")[0] != 'undefined') {
				var obj = $("#spots-template");
				// does a quick pull for all spots
				var url = "http://" + _$spot_url + "/spot?callback=?";
				var infoWindow;
				$.ajax({
					dataType: "jsonp",
					jsonp: "callback",
					url: url,
					success: function(data) {
						var item, obj;
						var delay = 0;
						// Work Around for The Map not always being loading 100% at end of page load
						if (typeof _$local.map.mapTypeId == 'undefined') {
							delay = 500;
						}
						window.setTimeout(function(){
							// @todo Make this information available in the Spot callback
							// @todo rather than doing 2 seperate queries
							for (item in data.results) {
								obj = data.results[item];
								obj.subscribed = false;										
								infoWindow = formatInfoWindow(obj);
								_$local.mapfunc.addmarker(obj.location.latitude, obj.location.longitude, infoWindow, false, obj.spotId, obj);
							}
							$.ajax({
								data: {
									userId: _$session_id
								},
								url: '/subscribe/spot',
								success: function(subscribe_data) {
									var subscribed = subscribe_data;
									for (item in data.results) {
										obj = data.results[item];
										obj.subscribed = false;
										for (x in subscribed) {
											if (subscribed[x].spotId == obj.spotId) {
												_$local.mapfunc.updatemarkerinfo(obj.spotId, true);
											}
										}
									}
								}
							});
						}, delay);
						var source = $("#spots-support").html();
						var template = Handlebars.compile(source);
						$(".spot_container").html(template(data));
						$(data.results).each(function(i, item){
//							loadForecast(item.spotId);
							loadKitescore(item.spotId, "#spot-detail-" + item.spotId);
						});
					},
					error: function() {
						var data = {
							results: []
						};
						var source = $("#spots-support").html();
						var template = Handlebars.compile(source);
						$(".spot_container").html(template(data));
					}
				});
			}

			if (typeof $("#spots-template")[0] != 'undefined') {
				var obj = $("#spots-template");
				// does a quick pull for all spots
				var url = "http://" + _$spot_url + "/spot?callback=?";
				$.ajax({
					dataType: "jsonp",
					jsonp: "callback",
					url: url,
					success: function(data) {
						var source = $("#spots-template").html();
						var template = Handlebars.compile(source);
						$(".spot_container").html(template(data));
						// load up the subscribes
						$.ajax({
							data: {
								userId: _$session_id
							},
							url: '/subscribe/spot',
							success: function(data) {
								$.each(data, function(i, item){
									if (item.spotId) {
										var id = item.spotId;
										var obj = $(".subscribe[data-attr='" + id + "']");
										obj.text("Subscribed");
										obj.addClass("btn-success").removeClass("btn-warning");
										obj.attr('method', 'DELETE');
									}
								});
							}
						});
					},
					error: function() {
						//console.log('oops');	
					}
				});
			}
			if (typeof $("#spotedit-template")[0] != 'undefined') {
				var obj = $("#spotedit-template");
				// does a quick pull for all spots
				var url = "http://" + _$spot_url + "/spot/" + _$spot_id + "?callback=?";
				$.ajax({
					dataType: "jsonp",
					jsonp: "callback",
					url: url,
					success: function(data) {
						var data = data[0];
						var source = obj.html();
						var template = Handlebars.compile(source);
						$(".spot_container").html(template(data));
						loadWindConditions();
						window._$local.spot['lat'] = parseFloat(jQuery("#lat").val());
						window._$local.spot['lon'] = parseFloat(jQuery("#lon").val());
						_$local.initializeGeomap(_$local.spot['lat'], _$local.spot['lon'])
					},
					error: function() {
						//console.log('oops');	
					}
				});
			}
			if (typeof $("#spotview-template")[0] != 'undefined') {
				var obj = $("#spotview-template");
				// does a quick pull for all spots
				var url = "http://" + _$spot_url + "/spot/" + _$spot_id + "?callback=?";
				$.ajax({
					dataType: "jsonp",
					jsonp: "callback",
					url: url,
					success: function(data) {
						var data = data[0];
						var source = obj.html();
						var template = Handlebars.compile(source);
						$(".spot_container").html(template(data));
						if (typeof initialize == 'function') {	
							initialize(data.location.latitude, data.location.longitude);
							loadnearby();
							loadKitescore(_$spot_id, '#kitescore_spot');
						}
					},
					error: function() {
						//console.log('oops');	
					}
				});
				
				$(".checkin").live("click", function(){
					var that = this;
					var url = "http://" + _$spot_url + "/checkin/spot/" + _$spot_id;
					var data = {userId: _$user_id};
					$.ajax({
						type: 'PUT',
						contentType: "application/json; charset=utf-8",
						dataType: "json",
						data: JSON.stringify(data),
						url: url,
						success: function(data) {
							$(that).remove();
							$(".active_users").prepend("<p>You were here just now.</p>");
						},
						error: function() {
							$(".active_users").prepend("<div class='alert helpful'>There was an issue checking you in, please try again.</div>");
							setTimeout(function(){
								$(".helpful").fadeOut(500, function(){
									$(this).remove();
								});
							}, 1000);
							//console.log('oops');	
						}
					});
				});				
			}
			
			if (typeof $("#spotcheckin-template")[0] != 'undefined') {
				function loadActivePeople() {
					var url = "http://" + _$spot_url + "/checkin/spot/" + _$spot_id;
					$.ajax({
						type: 'GET',
						dataType: "json",
						data: {
							userId: _$user_id
						},
						url: url,
						success: function(data) {
							$(data).each(function(i, item){
								item.createdFrom = false;
								if (item.createdAt) {
									item.createdFrom = moment(item.createdAt).fromNow()
								}
							});
							if (data.length > 0) {
								var data = {
									results: data	
								};
							} else {
								var data = {};
							}
							var obj = $("#spotcheckin-template");
							var source = obj.html();
							var template = Handlebars.compile(source);
							$(".active_users").html(template(data));
						}, 
						error: function() {
							$(".active_users").html("Current kiters unavailable at the moment.");
						}
					});
				}
				
				window.setTimeout(function(){
					loadActivePeople();					
				}, 1500);
	
				// @todo - Make this work with Socket.IO
//				_$local.peopleload = window.setInterval(function(){
//					loadActivePeople();
//				}, 5000);
				
			}
			
			if (typeof $("#spotweather-template")[0] != 'undefined') {
				loadForecast();
			}
			
			if (typeof $("#spotnew-template")[0] != 'undefined') {
				var obj = $("#spotnew-template");
				var source = obj.html();
				var template = Handlebars.compile(source);
				$(".spot_container").html(template({}));
			}
		}
				
		function loadDiscoverBy(_$kite_url, callback) {
			_$local.getGeolocation(function(){
				if (typeof callback == 'function') {
					callback();
				}
			});
		}

		// Logic To Handle Spitting out the Spot Themselves		
		if (typeof _$kite_url != 'undefined') {
			$(".browse").live("change", function(e){
				e.preventDefault();
				var that = this;
				_$local.discover_radius = $(that).find(":selected").val();
				$(".spot_container").html("Loading...");
				$(".radius_distance").html(_$local.discover_radius);

				loadDiscoverBy(_$kite_url, function(){
					var url = "http://" + _$kite_url + "/spot";
					$.ajax({
						dataType: "json",
						data: {
							discover_nearby: true,
							lat: _$local.geolocal.lat,
							lon: _$local.geolocal.lon,
							miles: _$local.discover_radius,
							userId: _$session_id
						},
						url: url,
						success: function(data) {
							var source = obj.html();
							var template = Handlebars.compile(source);
							$(".spot_container").html(template(data));
							$(data.results).each(function(i, item){
								loadForecast(item.spotId);
								loadKitescore(item.spotId);
							});
						},
						error: function() {
							//console.log('oops');	
						}
					});
				});

			});

			if (typeof $("#kitespot-template")[0] != 'undefined') {
				var obj = $("#kitespot-template");
				// discover nearby uses a different approach to getting 'spots'
				if (_$local.discover_nearby === true) {
					loadDiscoverBy(_$kite_url, function(){
						var url = "http://" + _$kite_url + "/spot";
						$.ajax({
							dataType: "json",
							data: {
								discover_nearby: true,
								lat: _$local.geolocal.lat,
								lon: _$local.geolocal.lon,
								miles: _$local.discover_radius,
								userId: _$session_id
							},
							url: url,
							success: function(data) {
								var source = obj.html();
								var template = Handlebars.compile(source);
								$(".spot_container").html(template(data));
								$(data.results).each(function(i, item){
									loadForecast(item.spotId);
									loadKitescore(item.spotId);
								});
							},
							error: function() {
								//console.log('oops');	
							}
						});
					});
 				} else {
 					loadDiscoverBy(_$kite_url, function(){
						var url = "http://" + _$kite_url + "/kite";
						$.ajax({
							dataType: "json",
							data: {
								userId: _$session_id,
								lat: _$local.geolocal.lat,
								lon: _$local.geolocal.lon
							},
							url: url,
							success: function(data) {
								$(data).each(function(i, item){
									item.distanceFrom = _$local.getDistanceFrom(_$local.geolocal.lat, _$local.geolocal.lon, item.location.latitude, item.location.longitude);
								});
								var data = {'results': data};
								var source = obj.html();
								var template = Handlebars.compile(source);
								$(".spot_container").html(template(data));
								$(data.results).each(function(i, item){
									loadForecast(item.spotId);
									loadKitescore(item.spotId);
								});
							},
							error: function() {
								var data = {};
								var source = $("#spots-error-template").html();
								var template = Handlebars.compile(source);
								$(".spot_container").html(template);
								setCountdown(59, function(){
									document.location.reload();
								});
							}
						});
 					});
				}
			}
		}
		
		function setCountdown(count, callback) {
			if (!count) var count = 60;
			var obj = $(".countdown");
			var counter = setInterval(function(){
				count = count-1;
				if (count <= 0) {
					clearInterval(counter);
					if (typeof callback == 'function') {
						callback();
					}
					return;
				}
				obj.html(count + " seconds...");
			}, 1000);
		}
		
		// Handle all the 'onSubmit' for ajax requests
		$(document).on("submit", "form.ajax-send", function(e){
			e.preventDefault();
			var that = this;
			// we serailzed the object, and then set spotId to be number (as per schema requirements)
			// if spotId actually does exist in our Form
			var d = $(that).serializeObject();
			if (typeof d.spotId != 'undefined') {	
				d.spotId = parseInt(d.spotId);
			}
			
			if (typeof d.lat != 'undefined') {
				d.lat = parseFloat(d.lat);
			}

			if (typeof d.lon != 'undefined') {
				d.lon = parseFloat(d.lon);
			}
			
			// get the wind conditions
			var winds = [];
			$(".wind_direction.active").each(function(i, item){
				winds.push($(item).val());
			});
			d['wind_directions'] = winds;
			var data = JSON.stringify(d);
			var send_url = jQuery(that).attr("action");

			var method = $(that).attr('method') || "POST";
			var redirect = $(that).attr('data-redirect') || false;
			
			$.ajax({
				url: send_url,
				type: method,
				contentType: "application/json; charset=utf-8",
				dataType: "json",
				data: data,
				success: function(response) {
					if (response.status) {
						var response = response.status;
					}
					$(".message").removeClass("hidden").html("<h3>" + response + "</h3>");
					window.setTimeout(function(){
						$(".message").fadeOut(500, function(){
							$(this).html("");
							$(this).addClass("hidden");
							$(this).removeAttr("style");
						});
					}, 2500);
					if (redirect) {
						window.location.href = redirect;
					}
					$('html:not(:animated), body:not(:animated)').animate({ scrollTop: 0 }, 'fast');
				},
				error: function(xhr) {
					console.log(xhr);
				}
			});
			return true;
		});
		
		bootstrap_alert = function(){ };
		bootstrap_alert.warning = function(msg, header) {
			if (!header) {
				var header = "Are you sure?";
			}
			$(".warning_msg").html('<div class="alert alert-error"><a class="close" data-dismiss="alert">×</a><h4 class="alert-heading">' + header + '</h4><p>' + msg + '</p></div>');
			$(".clear-alert", ".warning_msg").live("click", function(){
				$(".warning_msg").html("");
			});
		}
		
		$(".removeSpot").live("click", function(e){
			var that = this;
			bootstrap_alert.warning("This action is not reversible, press the 'delete me forever' button if you really wish to continue.<br /><br /><a class='btn btn-inverse delete-forever' action='" + $(that).attr('action') + "'>Delete Me Forever</a> <a class='btn btn-success clear-alert' data-dismiss='alert'>No Thanks, Cancel this Action</a>", "You're about to delete this spot, Are you really sure??");
		});
		$(".delete-forever").live("click", function(){
			var that = this;
			var send_url = jQuery(that).attr("action");
			$.ajax({
				url: send_url,
				type: "DELETE",
				contentType: "application/json; charset=utf-8",
				dataType: "json",
				data: {},
				success: function(response) {
					$(".message").removeClass("hidden").html("<h3>" + response + "</h3>");
					window.setTimeout(function(){
						$(".message").fadeOut(500, function(){
							$(this).html("");
							$(this).addClass("hidden");
							$(this).removeAttr("style");
						});
						window.location.href = "/main/spots";
					}, 2500);
				}			
			})			
		});
		
		$(".subscribe").live("click", function(e){
			e.preventDefault();
			var that = this;
			var send_url = $(that).attr('action');
			var method = $(this).attr('method') || "PUT";
			var spot_id = $(that).attr('data-attr');

			var data = {
				'userId': _$session_id
			};
			var data = JSON.stringify(data);
			$.ajax({
				url: send_url,
				type: method,
				contentType: "application/json; charset=utf-8",
				dataType: "json",
				data: data,
				beforeSend: function(){
    				$(that).html("Submitting..").removeClass("btn-warning").addClass("btn-primary");
				},
				success: function(response) {
					if (method == "PUT") {
						_$local.mapfunc.updatemarkerinfo(spot_id, true);
						$(that).html("Un-Subscribe");
						$(that).removeClass("btn-success").addClass("btn-warning");
						$(that).attr('method', 'DELETE');
					} else {
						_$local.mapfunc.updatemarkerinfo(spot_id, false);
						$(that).html("Subscribe");
						$(that).removeClass("btn-warning").addClass("btn-success");
						$(that).attr('method', 'PUT');						
					}
				}
			})			
		})

		if (typeof Handlebars != 'undefined') {
			Handlebars.registerHelper('ifCond', function(v1, v2, options) {
				if(v1 == v2) {
					return options.fn(this);
				}
				return options.inverse(this);
			});

			Handlebars.registerHelper('looper', function(list, delimiter, options) {
				if (!delimiter) {
					var delimiter = ",";
				}
				var hlist = "";
				for (var i in list) {
					hlist += list[i];
					if (i < (list.length - 1)) {
						hlist += delimiter + " ";
					}
				}
				return hlist;
			});
		}
				
		
		function typeahead_register() {
			$(".nearby_search").typeahead({
				source: ['Englewood, FL', '34223', 'Tampa, FL', '33611'],
				items: 9,
				minLength: 2
			});
		}
		
		$(".update_location").live("click", function(e){
			e.preventDefault();
			$(this).addClass("hidden");
			$(".location_description").html("Getting Update...");
			_$local.pullGeolocation();
		});
		$(".update_spot_location").live("click", function(e){
    		e.preventDefault();
    		$("#input_location").val("Loading...");
			_$local.pullGeolocation(function(){
				_$local.getGeolocation(function(){
					_$local.initializeGeomap(_$local.returnGeolocation()['lat'], _$local.returnGeolocation()['lon'])			
					$(".search-query").val(_$local.returnGeolocation()['street']);
					$(".latlon").html(_$local.returnGeolocation()['lat'] + ", " + _$local.returnGeolocation()['lon']);
				});
			});
		});
		if (_$local.load_spot === true) {
			_$local.initializeGeomap(_$local.spot['lat'], _$local.spot['lat'])
		} else {
			if (typeof _$local.ignore_geo == 'undefined') {
				_$local.getGeolocation(function(){
					_$local.initializeGeomap(_$local.returnGeolocation()['lat'], _$local.returnGeolocation()['lon'])			
					$(".search-query").val(_$local.returnGeolocation()['street']);
					$(".latlon").html(_$local.returnGeolocation()['lat'] + ", " + _$local.returnGeolocation()['lon']);
				});
			}
		}

	});

	// Required by getDistanceFrom()
	String.prototype.toRad = function() {
		return this * (Math.PI / 180);
	}

	// Required by getDistanceFrom()
	Number.prototype.toRad = function() {
		return this * (Math.PI / 180);
	}

})(jQuery)

