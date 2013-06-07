var correctedViewportW = (function (win, docElem) {

    var mM = win['matchMedia'] || win['msMatchMedia']
      , client = docElem['clientWidth']
      , inner = win['innerWidth']

    return mM && client < inner && true === mM('(min-width:' + inner + 'px)')['matches']
        ? function () { return win['innerWidth'] }
        : function () { return docElem['clientWidth'] }

}(window, document.documentElement));

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
			ignore_geo: false,
			ignore_mapload: false,
			load_spot: false,
			load_map: false,
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
			if (!lat1 || !lon1) {
				return false;
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
		
		_$local.hardFail = function(reason) {
			$("#fatalError").modal();
			if (reason) {
				$(".reason", "#fatalError").html(reason);				
			}
			window.setTimeout(function(){
				window.location.reload();
			}, 5500);
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
				}, function(){
					_$local.hardFail("Failed to lookup Geolocation via Browser.");
				},
				{timeout: "5000"});
			} else {
				$(".location_description").html("<p class='alert'>It seems we can't verify your location. <br /><input type='text' placeholder='Please enter a nearby city name or zipcode....' id='nearby_search' class='input-block-level nearby_search' /></p>");
				typeahead_register();
			}
		}
		
		_$local.mapfunc = {};
		_$local.map = {};
		_$local.mapmarkers = [];
		_$local.maptemp = {};
		
		_$local.mapfunc.buildinfo = function(content) {
    		var a = jQuery("<div></div>");
    		return a.html();
		}
		
		_$local.mapfunc.formatNewSpotWindow = function(object) {
    		var obj, source, template;
			obj = $("#spots-new-infowindow");
			source = obj.html();
			template = Handlebars.compile(source);
			return template(object);			
		};
		
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
		
		_$local.mapfunc.addmarker = function(lat, lon, html, blue, spotId, obj, open) {
			if (!open) {
				var open = false;
			}
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
    		
    		// No Map Exists on this Page (odd)
    		if (Object.keys(_$local.map).length == 0) {
	    		return true;
    		}
    		
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
    		if (open) {
	    		infowindow.open(_$local.map, marker);
    		}
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

		// Easy method for a Call to nearby Spots
		function loadComments(spot_id) {
			$.ajax({
				url: '/spotmedia/' + spot_id,
				datatype: "json",
				success: function(data){
					var d = { results: data };
					var obj = $("#spotsview-commentphoto");
					var source = obj.html();
					var template = Handlebars.compile(source);
					$(".photos").html(template(d));
					$(".gallery1").colorbox({rel:'gallery1'});
				},
				error: function() {
					$(".photos").html("We are unable to load this at the moment. Please sit tight.");
				}
			});
		}
		
		function parseForGraph(data) {
			var x = [], y = [], z = [], za = [], xa = [];
			$(data).each(function(i, item){
			     // One Forecasting System
			     if (typeof item.time !== 'undefined') {
    			     x.push(item.time.civil);
    			     xa.push(item.time);
			     }
			     // Data from another forecasting system
			     if (typeof item.FCTTIME !== 'undefined') {
    			     xa.push(item.FCTTIME);
    			     x.push(item.FCTTIME.civil);
    			     z.push(item.wdir);
    			     za.push(item.wspd);
			     }
				y.push(item.kiteScore);
			});
			return [x, y, z, za, xa];
		}
		
		Raphael.fn.getIcon = function(id, settings) {
			var settings_default = {
				fill: "#000",
				stroke: "none"
			};
			settings = $.extend(true, {}, settings_default, settings || {});
			var icons = {
				'cloud-lightning': 'M25.371,7.306c-0.092-3.924-3.301-7.077-7.248-7.079c-2.638,0.001-4.942,1.412-6.208,3.517c-0.595-0.327-1.28-0.517-2.01-0.517C7.626,3.229,5.772,5.033,5.689,7.293c-2.393,0.786-4.125,3.025-4.127,5.686c0,3.312,2.687,6,6,6v-0.002h5.271l-2.166,3.398l1.977-0.411L10,30.875l9.138-10.102L17,21l2.167-2.023h4.269c3.312,0,6-2.688,6-6C29.434,10.34,27.732,8.11,25.371,7.306zM23.436,16.979H7.561c-2.209-0.006-3.997-1.792-4.001-4.001c-0.002-1.982,1.45-3.618,3.35-3.931c0.265-0.043,0.502-0.191,0.657-0.414C7.722,8.41,7.779,8.136,7.73,7.87C7.702,7.722,7.685,7.582,7.685,7.446C7.689,6.221,8.68,5.23,9.905,5.228c0.647,0,1.217,0.278,1.633,0.731c0.233,0.257,0.587,0.375,0.927,0.309c0.342-0.066,0.626-0.307,0.748-0.63c0.749-1.992,2.662-3.412,4.911-3.41c2.899,0.004,5.244,2.35,5.251,5.249c0,0.161-0.009,0.326-0.027,0.497c-0.049,0.517,0.305,0.984,0.815,1.079c1.86,0.344,3.274,1.966,3.271,3.923C27.43,15.186,25.645,16.973,23.436,16.979z',
				'cloud-rain': 'M25.371,7.306c-0.092-3.924-3.301-7.077-7.248-7.079c-2.638,0.001-4.942,1.412-6.208,3.517c-0.595-0.327-1.28-0.517-2.01-0.517C7.626,3.229,5.772,5.033,5.689,7.293c-2.393,0.786-4.125,3.025-4.127,5.686c0,3.312,2.687,6,6,6v-0.002h15.874c3.312,0,6-2.688,6-6C29.434,10.34,27.732,8.11,25.371,7.306zM23.436,16.979H7.561c-2.209-0.006-3.997-1.792-4.001-4.001c-0.002-1.982,1.45-3.618,3.35-3.931c0.265-0.043,0.502-0.191,0.657-0.414C7.722,8.41,7.779,8.136,7.73,7.87C7.702,7.722,7.685,7.582,7.685,7.446C7.689,6.221,8.68,5.23,9.905,5.228c0.647,0,1.217,0.278,1.633,0.731c0.233,0.257,0.587,0.375,0.927,0.309c0.342-0.066,0.626-0.307,0.748-0.63c0.749-1.992,2.662-3.412,4.911-3.41c2.899,0.004,5.244,2.35,5.251,5.249c0,0.161-0.009,0.326-0.027,0.497c-0.049,0.517,0.305,0.984,0.815,1.079c1.86,0.344,3.274,1.966,3.271,3.923C27.43,15.186,25.645,16.973,23.436,16.979zM9.029,26.682c0-1.115,0.021-5.425,0.021-5.432c0.002-0.409-0.247-0.779-0.628-0.932c-0.38-0.152-0.815-0.059-1.099,0.24c-0.006,0.008-1.037,1.098-2.081,2.342c-0.523,0.627-1.048,1.287-1.463,1.896c-0.399,0.648-0.753,1.066-0.811,1.885C2.971,28.355,4.324,29.711,6,29.714C7.672,29.71,9.029,28.354,9.029,26.682zM4.971,26.727c0.091-0.349,1.081-1.719,1.993-2.764c0.025-0.029,0.051-0.061,0.076-0.089c-0.005,1.124-0.01,2.294-0.01,2.808c0,0.567-0.461,1.028-1.029,1.03C5.447,27.71,4.997,27.273,4.971,26.727zM16.425,26.682c0-1.115,0.021-5.424,0.021-5.43c0.002-0.41-0.247-0.779-0.628-0.934c-0.381-0.152-0.814-0.058-1.1,0.242c-0.006,0.008-1.035,1.094-2.08,2.342c-0.522,0.623-1.047,1.285-1.463,1.894c-0.399,0.649-0.753,1.068-0.809,1.888c0,1.672,1.354,3.028,3.029,3.028C15.068,29.711,16.425,28.354,16.425,26.682zM12.365,26.729c0.092-0.349,1.081-1.72,1.993-2.765c0.025-0.03,0.05-0.06,0.075-0.089c-0.005,1.123-0.011,2.294-0.011,2.807c-0.002,0.568-0.461,1.027-1.028,1.029C12.84,27.709,12.392,27.273,12.365,26.729zM23.271,20.317c-0.38-0.153-0.816-0.06-1.099,0.24c-0.009,0.008-1.037,1.097-2.08,2.342c-0.523,0.625-1.049,1.285-1.462,1.896c-0.402,0.649-0.754,1.067-0.812,1.886c0,1.672,1.354,3.029,3.03,3.029c1.673,0,3.027-1.357,3.027-3.029c0-1.115,0.022-5.425,0.022-5.431C23.9,20.84,23.651,20.47,23.271,20.317zM21.879,26.681c-0.004,0.568-0.463,1.027-1.031,1.029c-0.553-0.002-1.002-0.438-1.028-0.982c0.092-0.349,1.081-1.72,1.993-2.765c0.025-0.028,0.05-0.059,0.074-0.088C21.883,24.998,21.879,26.167,21.879,26.681z',
				'cloud-partysun': 'M14.378,6.781c0.41,0.988,1.938,0.346,1.524-0.648C15.708,5.667,15.515,5.2,15.32,4.734c-0.289-0.695-0.875-3.233-2.042-2.747c-1.03,0.433-0.128,1.846,0.142,2.494C13.739,5.248,14.059,6.015,14.378,6.781M20.8,7.223c1.094,0.453,1.538-1.551,1.813-2.216c0.281-0.677,1.478-2.565,0.357-3.029c-1.092-0.453-1.537,1.548-1.813,2.216C20.876,4.872,19.68,6.757,20.8,7.223M18.137,6.692c1.183,0,0.829-2.019,0.829-2.742c0-0.732,0.383-2.935-0.829-2.935c-1.183,0-0.828,2.019-0.828,2.742C17.309,4.49,16.926,6.692,18.137,6.692M23.058,8.729c0.852,0.85,2.142-0.972,2.659-1.49c0.512-0.513,2.187-1.687,1.352-2.524c-0.834-0.836-2.013,0.843-2.522,1.353C24.028,6.585,22.198,7.874,23.058,8.729M24.565,10.986c0.448,1.091,2.183-0.01,2.849-0.286c0.676-0.28,2.858-0.771,2.394-1.89c-0.455-1.091-2.181,0.008-2.849,0.285C26.281,9.377,24.102,9.866,24.565,10.986M12.036,8.742c0.752,0.75,1.932-0.415,1.17-1.173c-0.253-0.347-0.646-0.645-0.949-0.946c-0.541-0.539-2.162-2.799-3.068-1.889c-0.79,0.791,0.586,1.755,1.083,2.25C10.859,7.57,11.447,8.156,12.036,8.742M29.365,17.397c-0.768-0.317-1.534-0.635-2.302-0.952c-0.646-0.268-2.07-1.169-2.495-0.135c-0.481,1.168,2.054,1.747,2.751,2.035c0.455,0.188,0.911,0.377,1.367,0.565C29.7,19.331,30.379,17.816,29.365,17.397M29.942,12.817c-0.83,0-1.66,0-2.49,0c-0.701,0-2.357-0.288-2.355,0.83c0,1.262,2.567,0.827,3.319,0.827c0.493,0,0.986,0,1.479-0.001C30.99,14.473,31.043,12.815,29.942,12.817M24.234,18.568c-0.673-0.673-1.773,0.189-1.281,1.007c-0.295-0.264-0.614-0.499-0.961-0.69c3.894-2.866,3.328-9.006-1.021-11.107c-2.024-0.978-4.481-0.828-6.368,0.394c-0.871,0.564-1.603,1.336-2.119,2.236c-0.262,0.456-0.468,0.943-0.612,1.449c-0.074,0.258-0.131,0.521-0.172,0.786c-0.083,0.534-0.109,0.553-0.553,0.871c-0.182-0.957-1.64-0.675-2.326-0.674c-0.815,0.001-1.963-0.217-2.752,0.046c-0.867,0.289-0.652,1.615,0.263,1.613c0.324,0.052,0.701-0.001,1.028-0.001c0.904-0.001,1.809-0.002,2.713-0.003c-0.308,0.352-0.496,0.969-0.94,0.77c-0.467-0.209-0.978-0.319-1.49-0.319c-0.951,0-1.877,0.375-2.561,1.036c-0.681,0.658-1.088,1.569-1.123,2.516c-0.944,0.31-1.791,0.891-2.421,1.658c-2.756,3.354-0.265,8.554,4.058,8.554v-0.002c3.597,0,7.194,0,10.792,0c1.341,0,2.843,0.167,4.168-0.113c3.652-0.772,5.361-5.21,3.133-8.229c0.548,0.547,1.096,1.094,1.644,1.641c0.183,0.183,0.364,0.424,0.575,0.574c0.552,0.552,1.524,0.066,1.403-0.713c-0.097-0.622-1.042-1.267-1.448-1.673C25.319,19.652,24.776,19.11,24.234,18.568M18.137,8.787c4.559,0.009,6.576,5.979,2.912,8.734c-0.637-3.505-4.161-5.824-7.629-5.03C13.943,10.367,15.852,8.792,18.137,8.787M22.895,24.08c-0.633,3.346-4.149,2.879-6.68,2.879c-3.017,0-6.033,0-9.049,0c-0.767,0-1.62,0.084-2.373-0.095c-2.274-0.538-3.416-3.242-2.172-5.235c0.678-1.087,1.568-1.19,2.626-1.67c0.604-0.273,0.456-0.807,0.456-1.331c0.002-0.597,0.284-1.169,0.756-1.533c0.787-0.608,1.943-0.497,2.611,0.234c1.098,1.205,1.96-1.346,2.507-1.893c2.025-2.025,5.475-1.708,7.068,0.684c0.344,0.516,0.581,1.102,0.693,1.712c0.097,0.529-0.115,1.341,0.188,1.796c0.291,0.47,0.943,0.463,1.397,0.68c0.508,0.23,0.963,0.591,1.304,1.034C22.834,22.125,23.064,23.107,22.895,24.08M6.906,9.917c0.881,0.364,1.763,0.727,2.644,1.091c0.353,0.146,0.707,0.292,1.06,0.437c0.997,0.412,1.637-1.119,0.642-1.526C10.47,9.441,9.456,9.177,8.609,8.828c-0.354-0.146-0.707-0.292-1.06-0.437C6.554,7.98,5.912,9.505,6.906,9.917',
				'sunshine': 'M15.502,7.504c-4.35,0-7.873,3.523-7.873,7.873c0,4.347,3.523,7.872,7.873,7.872c4.346,0,7.871-3.525,7.871-7.872C23.374,11.027,19.85,7.504,15.502,7.504zM15.502,21.25c-3.244-0.008-5.866-2.63-5.874-5.872c0.007-3.243,2.63-5.866,5.874-5.874c3.242,0.008,5.864,2.631,5.871,5.874C21.366,18.62,18.744,21.242,15.502,21.25zM15.502,6.977c0.553,0,1-0.448,1-1.001V1.125c-0.002-0.553-0.448-1-1-1c-0.553,0-1.001,0.449-1,1.002v4.85C14.502,6.528,14.949,6.977,15.502,6.977zM18.715,7.615c0.125,0.053,0.255,0.076,0.382,0.077c0.394,0,0.765-0.233,0.925-0.618l1.856-4.483c0.21-0.511-0.031-1.095-0.541-1.306c-0.511-0.211-1.096,0.031-1.308,0.541L18.174,6.31C17.963,6.82,18.205,7.405,18.715,7.615zM21.44,9.436c0.195,0.194,0.451,0.293,0.707,0.293s0.512-0.098,0.707-0.293l3.43-3.433c0.391-0.39,0.39-1.023,0-1.415c-0.392-0.39-1.025-0.39-1.415,0.002L21.44,8.021C21.049,8.412,21.049,9.045,21.44,9.436zM23.263,12.16c0.158,0.385,0.531,0.617,0.923,0.617c0.127,0,0.257-0.025,0.383-0.078l4.48-1.857c0.511-0.211,0.753-0.797,0.541-1.307s-0.796-0.752-1.307-0.54l-4.481,1.857C23.292,11.064,23.051,11.65,23.263,12.16zM29.752,14.371l-4.851,0.001c-0.552,0-1,0.448-0.998,1.001c0,0.553,0.447,0.999,0.998,0.999l4.852-0.002c0.553,0,0.999-0.449,0.999-1C30.752,14.817,30.304,14.369,29.752,14.371zM29.054,19.899l-4.482-1.854c-0.512-0.212-1.097,0.03-1.307,0.541c-0.211,0.511,0.031,1.096,0.541,1.308l4.482,1.854c0.126,0.051,0.256,0.075,0.383,0.075c0.393,0,0.765-0.232,0.925-0.617C29.806,20.695,29.563,20.109,29.054,19.899zM22.86,21.312c-0.391-0.391-1.023-0.391-1.414,0.001c-0.391,0.39-0.39,1.022,0,1.413l3.434,3.429c0.195,0.195,0.45,0.293,0.706,0.293s0.513-0.098,0.708-0.293c0.391-0.392,0.389-1.025,0-1.415L22.86,21.312zM20.029,23.675c-0.211-0.511-0.796-0.752-1.307-0.541c-0.51,0.212-0.752,0.797-0.54,1.308l1.86,4.48c0.159,0.385,0.531,0.617,0.925,0.617c0.128,0,0.258-0.024,0.383-0.076c0.511-0.211,0.752-0.797,0.54-1.309L20.029,23.675zM15.512,23.778c-0.553,0-1,0.448-1,1l0.004,4.851c0,0.553,0.449,0.999,1,0.999c0.553,0,1-0.448,0.998-1l-0.003-4.852C16.511,24.226,16.062,23.777,15.512,23.778zM12.296,23.142c-0.51-0.21-1.094,0.031-1.306,0.543l-1.852,4.483c-0.21,0.511,0.033,1.096,0.543,1.307c0.125,0.052,0.254,0.076,0.382,0.076c0.392,0,0.765-0.234,0.924-0.619l1.853-4.485C13.051,23.937,12.807,23.353,12.296,23.142zM9.57,21.325c-0.392-0.391-1.025-0.389-1.415,0.002L4.729,24.76c-0.391,0.392-0.389,1.023,0.002,1.415c0.195,0.194,0.45,0.292,0.706,0.292c0.257,0,0.513-0.098,0.708-0.293l3.427-3.434C9.961,22.349,9.961,21.716,9.57,21.325zM7.746,18.604c-0.213-0.509-0.797-0.751-1.307-0.54L1.96,19.925c-0.511,0.212-0.752,0.798-0.54,1.308c0.16,0.385,0.531,0.616,0.924,0.616c0.127,0,0.258-0.024,0.383-0.076l4.479-1.861C7.715,19.698,7.957,19.113,7.746,18.604zM7.1,15.392c0-0.553-0.447-0.999-1-0.999l-4.851,0.006c-0.553,0-1.001,0.448-0.999,1.001c0.001,0.551,0.449,1,1,0.998l4.852-0.006C6.654,16.392,7.102,15.942,7.1,15.392zM1.944,10.869l4.485,1.85c0.125,0.053,0.254,0.076,0.381,0.076c0.393,0,0.766-0.232,0.925-0.618c0.212-0.511-0.032-1.097-0.544-1.306L2.708,9.021c-0.511-0.21-1.095,0.032-1.306,0.542C1.19,10.074,1.435,10.657,1.944,10.869zM8.137,9.451c0.195,0.193,0.449,0.291,0.705,0.291s0.513-0.098,0.709-0.295c0.391-0.389,0.389-1.023-0.004-1.414L6.113,4.609C5.723,4.219,5.088,4.221,4.699,4.612c-0.391,0.39-0.389,1.024,0.002,1.414L8.137,9.451zM10.964,7.084c0.16,0.384,0.532,0.615,0.923,0.615c0.128,0,0.258-0.025,0.384-0.077c0.51-0.212,0.753-0.798,0.54-1.307l-1.864-4.479c-0.212-0.51-0.798-0.751-1.308-0.539C9.129,1.51,8.888,2.096,9.1,2.605L10.964,7.084z',
				'arrow-two': 'M90,40M80,30L100,30L100,24L110,40L100,56L100,50L80,50L80,56L70,40L80,24Z',
				'arrow-right': 'M15.834,29.084 15.834,16.166 2.917,16.166 29.083,2.917z',
				'arrow-up': 'M23.963,20.834L17.5,9.64c-0.825-1.429-2.175-1.429-3,0L8.037,20.834c-0.825,1.429-0.15,2.598,1.5,2.598h12.926C24.113,23.432,24.788,22.263,23.963,20.834z',
				'arrow-wind': 'M 16.001,0.00L0.00,16.00L 10.00,16.00L 10.00,32.00L 22.00,32.00L 22.00,16.00L 32.00,16.00 z'
			};
			return this.path(icons[id]).attr(settings);
		}
				
		function newGraphic(spot_id, data, max_spots) {
			var y = [], z=[], x=[], i=0, max_size=20, counter=0, 
			min_size=1, top_padding=0, padding=4, gutter=20, position=0, 
			radius=20, left_side=0, top_side=0, auto_load = false, 
			window_width = $(window).width();

			var pixel_width_length = 25;

			if (!max_spots) {
				if (window_width <= 640) {
					max_spots = 72; // 3 days
					auto_load = true;
				} else {
					// 7 Days
					max_spots = 168;
				}
			}

			x = data[0];
			y = data[1];
			z = data[2];
			za = data[3];
			xa = data[4];
			
			var picture_width = (pixel_width_length * parseInt(max_spots)) + 10;

			var b = Raphael(spot_id, picture_width, 120);
    		var r = Raphael(spot_id, picture_width, 145);

    		var height = 120, sleft=0, stop=0, width=0, left_position=0;
    		padding = 2;
    		top_padding = 20;
    		
    		var x_width = 25;
    		var x_padding = 2;
    		var height = 60;
    		var start_position = x_width - 10;
    		var starting_point = 100;
    		var bottom_padding = 12;
    		
    		for (i in y) {
    			if (max_spots !== "all" && counter >= max_spots) {
	    			continue;
    			}    		
	    		obj_val = y[i];
	    		var bar_height = (parseInt(obj_val) * 4);

	    		left_position = (x_width * i) + start_position;
    			width = obj_val + (2 * parseInt(x_padding));
	    		sleft = left_position;
	    		stop = starting_point - ((parseInt(height) / 2) + (width / 2) + top_padding);

	    		// [ x, y, w, h ]
	    		// circle = r.rect(sleft, height, x_width, bar_height)
	    		// cirlce = r.rect(sleft, (starting_point - bar_height), x_width, bar_height

	    		var circle = r.rect(sleft, (starting_point - bar_height), x_width, bar_height);
	    		
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

	    		// KiteScore Cirlce
//	    		var c2 = r.circle(sleft+(x_width/2), (starting_point + bottom_padding), 10);
//	    		c2.attr('fill', '#000');
//	    		c2.attr('color', '#FFF');
	    		// Kitescore Value
	    		var txt = r.text(sleft+(x_width/2), (starting_point + bottom_padding), obj_val);
	    		txt.attr({'font':'12px Fontin-Sans, Arial', fill: '#000', stroker: 'none'});


	    		var wind_speed = r.text(left_position + (x_width / 2), (starting_point - 20), za[i].english + " MPH");
	    		wind_speed.attr({'font':'10px Fontin-Sans, Arial', fill: '#000', stroker: 'none'});
				wind_speed.transform("r-90");

	    		position += width;
    			counter++;
    		}
    		$("#" + spot_id + "-loader").remove();
       		
    		$("#" + spot_id).addClass("scroll-pane ui-widget ui-widget-header ui-corner-all").removeClass("hidden");
		}
		

		function subscribe_spot(data) {
			$.ajax({
				type: 'PUT',
				dataType: 'json',
				contentType: "application/json; charset=utf-8",
				url: '/subscribe/spot/' + data.id,
				data: JSON.stringify({
					userId: _$session_id
				})
			});
		}

		
		function loadKitescore(spot_id, override_id, override) {
			var spot = spot_id || _$spot_id;
			if (!spot) {
				return false;
			}
			if (!override) {
				var override = false;
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
					if (override === true) {
						$("#" + spot_id).html("");
					}
					newGraphic(spot_id, d);
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
						
						if (typeof data.forecast.currently == 'undefined') {
							$(".active_weather", parent).html("Current weather is unavailable at the moment.");
							return true;
						}

						var current_forecast = data.forecast;
						//current_forecast.details = data.forecast.currently.summary;
						//current_forecast.google_image_url = data.forecast.icon; // need to map the options to a url! i.e. 
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

		$(".profile_avatar").live("click", function(){
			$(".qq-upload-list", "#uploadModal").html("");
			$("#uploadModal").modal('show');
		});

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
							
							var input = document.getElementById("search_spot_input");
							var autocomplete = new google.maps.places.Autocomplete(input);
							autocomplete.bindTo("bounds", _$local.map);

							google.maps.event.addListener(autocomplete, "place_changed", function(){
								var place = autocomplete.getPlace();
								_$local.maptemp = place;
								if (place.geometry.viewport) {
									_$local.map.fitBounds(place.geometry.viewport);
								} else {
									_$local.map.setCenter(place.geometry.location);
									_$local.map.setZoom(15);
								}
								
								// @todo Make this be the updated Marker (of me) -- in 'Red'
								marker.setPosition(place.geometry.location);
							})
							
							google.maps.event.addListener(_$local.map, "click", function(event){
								var lat = event.latLng.lat();
								var lng = event.latLng.lng();
								var location = new google.maps.LatLng(lat, lng);
								var url = "//maps.googleapis.com/maps/api/geocode/json?latlng=" + lat + "," + lng + "&sensor=true";
								$.getJSON(url, function(data){
									var location = data.results[0].formatted_address;
									var html = _$local.mapfunc.formatNewSpotWindow({name: location, lat: lat, lng: lng});
									_$local.mapfunc.addmarker(lat, lng, html, false, null, null, true);
								});
							})
							
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
										obj.text("Stop Watching");
										obj.addClass("btn-success").removeClass("btn-warning");
										obj.attr('method', 'DELETE');
									}
								});
							}
						});
					},
					error: function() {
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
					}
				});
			}
			
			$(".status_opener, .load-spot-details").live("click", function(e){
				e.preventDefault();
				var that, spot_id, loader, status;
				that = $(this);
				spot_id = that.attr('data-value');
				status = $(".status_opener", "#spot-" + spot_id);
				loader = $("#kitegraph-" + spot_id + "-loader-details");
				if (status.hasClass("icon-plus-sign")) {
					status.removeClass('icon-plus-sign').addClass('icon-minus-sign');
					loader.removeClass("hidden");
					loader.html("<div id='kitegraph-" + spot_id + "'><i class='icon-spinner icon-spin icon-large'></i> Loading...</div>");
					loader.prepend(jQuery("<div></div>").html("<a href='/main/spots/view/" + spot_id + "' class='btn btn-info'>View</a> <a action='/subscribe/spot/" + spot_id + "' data-attr='" + spot_id + "' method='PUT' class='btn btn-success subscribe'>Watch</a>"));
					loadKitescore(spot_id, '#spot-' + spot_id, true);
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
									obj.text("Stop Watching");
									obj.addClass("btn-warning").removeClass("btn-success");
									obj.attr('method', 'DELETE');
								}
							});
						}
					});
				} else {
					status.removeClass('icon-minus-sign').addClass('icon-plus-sign');
					loader.addClass("hidden");
					loader.html("");
				}
			});
			
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
							loadComments(_$spot_id);
						}
						// ideally this information should be in the spot request (not as two seperate queries)
						$.ajax({
							dataType: "json",
							url: "/subscribe/spot/" + _$spot_id,
							data: {
								'userId': _$session_id
							},
							success: function(data) {
								if (data.length > 0) {
									$(".subscribe", "#spot-" + _$spot_id).removeClass("btn-success").addClass("btn-warning").attr('method', 'DELETE').text("Stop watching");
								}
								$(".subscribe").removeClass("hidden");
							},
							error: function() {
							}
						});
					},
					error: function() {
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
			/**
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
						}
					});
				});

			});
			**/

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
			var post_parse = $(that).attr('data-post-parse') || false;
			var parse_json = $(that).attr('parse-json') || false;
			
			$.ajax({
				url: send_url,
				type: method,
				contentType: "application/json; charset=utf-8",
				dataType: "json",
				data: data,
				success: function(response, status, xhr) {
					if (parse_json) {
						var response = JSON.parse(response);
					}
					if (post_parse) {
						eval(post_parse+"(response)");
					}
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
					//console.log(xhr);
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
						$(that).html("Un-Watch");
						$(that).removeClass("btn-success").addClass("btn-warning");
						$(that).attr('method', 'DELETE');
					} else {
						_$local.mapfunc.updatemarkerinfo(spot_id, false);
						$(that).html("Watch");
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
		
		$(".update_location, .location_description").live("click", function(e){
			e.preventDefault();
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
			_$local.initializeGeomap(_$local.spot['lat'], _$local.spot['lon'])
		} else {
			if (_$local.ignore_geo === true) {
				if (_$local.ignore_mapload === true) {
					// only load up the GeoLocation() (used for User specific Info)
					_$local.getGeolocation();
				} else {
					// load up the Geo and load up the Map on Map + .latlon & .search-query input
					_$local.getGeolocation(function(){
						_$local.initializeGeomap(_$local.returnGeolocation()['lat'], _$local.returnGeolocation()['lon'])
						$(".search-query").val(_$local.returnGeolocation()['street']);
						$(".latlon").html(_$local.returnGeolocation()['lat'] + ", " + _$local.returnGeolocation()['lon']);
					});					
				}
			}
		}
		
		if (_$local.load_map === true) {
			// load up the Geo and load up the Map on Map + .latlon & .search-query input
			_$local.getGeolocation(function(){
				_$local.initializeGeomap(_$local.returnGeolocation()['lat'], _$local.returnGeolocation()['lon'])
			});
		}

		$(".open-comments").live("click", function(e){
			e.preventDefault();
			var comments = $(".comment-add");
			if (comments.hasClass('hidden')) {
				comments.removeClass('hidden');
			} else {
				comments.addClass('hidden');				
			}
		})

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

