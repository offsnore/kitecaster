// Custom Handler used to Handle Custom Calls and functionality
(function($){	
	$(document).ready(function(){
		$("div.btn-group input[type='button']").click(function(){
			var hidden_label = $(this).attr('name').toString().split("_")[1];
			console.log(hidden_label, $(this).attr('id'));
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
				complete: function(obj, data) {
//					debugger;
				}
			});
		}	

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

