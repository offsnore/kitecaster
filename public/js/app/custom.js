// Custom Handler used to Handle Custom Calls and functionality
(function($){	
	$(document).ready(function($){

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

		$("div.btn-group input[type='button']").click(function(){
			var hidden_label = $(this).attr('name').toString().split("_")[1];
			//console.log(hidden_label, $(this).attr('id'));
			$("#" + hidden_label).attr("value", $(this).attr('id'));
		});
		$("div.btn-group input[type='button']").click(function(){
			$("")
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
			var obj = $("#spots-template");
			if (typeof obj[0] != 'undefined') {
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
					},
					error: function() {
						//console.log('oops');	
					}
				});
			}
			
			var obj = $("#spotedit-template");
			if (typeof obj[0] != 'undefined') {
				// does a quick pull for all spots
				var url = "http://" + _$spot_url + "/spot/" + _$spot_id + "?callback=?";
				$.ajax({
					dataType: "jsonp",
					jsonp: "callback",
					url: url,
					success: function(data) {
						var source = obj.html();
						var template = Handlebars.compile(source);
						$(".spot_container").html(template(data[0]));
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
			var data = JSON.stringify(d);
			var send_url = jQuery(that).attr("action");
			$.ajax({
				url: send_url,
				type: "POST",
				contentType: "application/json; charset=utf-8",
				dataType: "json",
				data: data,
				success: function(data) {
					$(".message").removeClass("hidden").html("<h3>Your spot has been updated!</h3>");
					window.setTimeout(function(){
						$(".message").fadeOut(500, function(){
							$(this).html("");
							$(this).addClass("hidden");
							$(this).removeAttr("style");
						});
					}, 2500);
					$('html:not(:animated), body:not(:animated)').animate({ scrollTop: 0 }, 'fast');
				},
				error: function(xhr) {
					console.log(xhr);
				}
			});
			return true;
		});

		if (typeof Handlebars != 'undefined') {
			Handlebars.registerHelper('ifCond', function(v1, v2, options) {
			  if(v1 == v2) {
			    return options.fn(this);
			  }
			  return options.inverse(this);
			});
		}

	});

})(jQuery)

