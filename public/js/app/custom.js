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
		
	});
})(jQuery)