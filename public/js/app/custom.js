// Custom Handler used to Handle Custom Calls and functionality
(function($){	

	if (typeof _$local == 'undefined') {
		_$local = {
			load_spot: false,
			spot: {}
		};
	}

	$(document).ready(function($){

		function detectBrowser() {
			var useragent = navigator.userAgent;
			var mapdiv = document.getElementById("map-canvas");
			if (useragent.indexOf('iPhone') != -1 || useragent.indexOf('Android') != -1 ) {
				mapdiv.style.width = '100%';
				mapdiv.style.height = '100%';
			}
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
			r.dotchart(0, 0, 620, 60, xs, ys, data, {
				symbol: "o", 
				max: 10, 
				heat: true, 
				axis: "1 0 0 0", 
				axisxstep: 23, 
				axisystep: 20,
				axisxlabels: axisx, 
				axisxtype: " ", 
				axisytype: " ", 
				axisylabels: axisy
			}).hover(function () {
				this.marker = this.marker || r.tag(this.x, this.y, this.value, 0, this.r + 2).insertBefore(this);
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
				x.push(item.time.civil);
				y.push(item.kiteScore);
			});
			return [x,y];
		}
		
		function loadKitescore(spot_id, override_id) {
			var spot = spot_id || _$spot_id;
			if (!spot) {
				return false;
			}
			var url = "http://" + _$spot_url + "/score/today";
			var parent = "#spot-" + spot;
			$.ajax({
				type: "GET",
				dataType: "json",
				data: {
					spotId: spot
				},
				url: url,
				success: function(data) {
					var graphId = parent + "-graph";
					if (override_id) {
						var graphId = override_id;
					}
					var d = parseForGraph(data);
					var graph = jQuery("<div></div>").attr('id', graphId);
					var title = jQuery("<h3></h3>").text("KiteScore (Kite Ability of This Spot)");
					if (override_id) {
						var parent = $("#" + override_id).parent();
						$("#" + override_id).html("");
					} else {
						$(parent).append(title);						
					}
					$(parent).append(graph);
					loadGraphic(graphId, d);
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
						var current_forecast = data.simpleforecast.forecastday[0];								
						current_forecast.details = data.txt_forecast.forecastday[0].fcttext;
						current_forecast.google_image_url = data.google_image_url;
					}
					var obj = $("#spotweather-template");
					var source = obj.html();
					var template = Handlebars.compile(source);
					$(".active_weather", parent).html(template(current_forecast));
				}, 
				error: function() {
					$(".active_weather", parent).html("Current kiters unavailable at the moment.");
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
		if ($("#travel_distance").length > 0) {
			var default_value = $("#travel_distance").val().toFixed(0);
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
							loadKitescore(_$spot_id, 'kitescore_spot');
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

		// Logic To Handle Spitting out the Spot Themselves		
		if (typeof _$kite_url != 'undefined') {
			if (typeof $("#kitespot-template")[0] != 'undefined') {
				var obj = $("#kitespot-template");
				var url = "http://" + _$kite_url + "/kite";
				$.ajax({
					dataType: "json",
					data: {
						userId: _$session_id
					},
					url: url,
					success: function(data) {
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
						//console.log('oops');	
					}
				});
			}
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
				success: function(response) {
					if (method == "PUT") {
						$(that).html("Subscribed");
						$(that).removeClass("btn-warning").addClass("btn-success");
						$(that).attr('method', 'DELETE');
					} else {
						$(that).html("Subscribe");
						$(that).removeClass("btn-success").addClass("btn-warning");
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
		
		_$local.pullGeolocation = function() {
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
							})
						});
					});
				});
			} else {
				$(".location_description").html("<p class='alert'>It seems we can't verify your location. <br /><input type='text' placeholder='Please enter a nearby city name or zipcode....' id='nearby_search' class='input-block-level nearby_search' /></p>");
				typeahead_register();
			}
		}
		
		function typeahead_register() {
			$(".nearby_search").typeahead({
				source: ['Englewood, FL', '34223', 'Tampa, FL', '33611'],
				items: 9,
				minLength: 2
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
					zoom: 11,
					mapTypeId: google.maps.MapTypeId.ROADMAP
				});	
				var marker = new google.maps.Marker({
					position: new google.maps.LatLng(lat, lon),
					map: map
				});
				google.maps.event.addListener(map, 'click', function(event){
					var latlong = parseFloat(event.latLng.lat()).toFixed(4) + ", " + parseFloat(event.latLng.lng()).toFixed(4);
					var url = "//maps.googleapis.com/maps/api/geocode/json?latlng=" + event.latLng.lat() + "," + event.latLng.lng() + "&sensor=true";
					$.ajax({
						url: url,
						dataType: "json",
						beforeSend: function() {
							$(".search-query").val("Loading..");
						},
						success: function(data){
							var addy = data.results[1].formatted_address;
							//console.log(data.results);
							//var address = addy[1].short_name + ", " + addy[2].short_name;
							$(".search-query").val(addy);
						},
						error: function() {
							$(".search-query").val("Something went wrong :( .. try again.");
						}
					});
					$(".latlon").text(latlong);
				});
			}
			jQuery(document).ready(function(){
				if (typeof google != 'undefined') {
					initialize();					
				}
			});
		}
		
		$(".update_location").live("click", function(e){
			e.preventDefault();
			$(this).addClass("hidden");
			$(".location_description").html("Getting Update...");
			_$local.pullGeolocation();
		});
		if (_$local.load_spot === true) {
			_$local.initializeGeomap(_$local.spot['lat'], _$local.spot['lat'])
		} else {
			_$local.getGeolocation(function(){
				_$local.initializeGeomap(_$local.returnGeolocation()['lat'], _$local.returnGeolocation()['lon'])			
				$(".search-query").val(_$local.returnGeolocation()['street']);
				$(".latlon").html(_$local.returnGeolocation()['lat'] + ", " + _$local.returnGeolocation()['lon']);
			});
		}
	});

})(jQuery)

