// Custom Handler used to Handle Custom Calls and functionality
(function($){	
	$(document).ready(function(){
		$("div.btn-group input[type='button']").click(function(){
			$("#gender").attr("value", $(this).attr('id'));
		})
	});
})(jQuery)