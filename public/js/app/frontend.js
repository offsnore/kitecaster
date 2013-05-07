$(document).ready(function(){
	$('#register-form').validate({
		rules: {
			firstname: {
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
			password: {
				minlength: 6,
				required: true
			},
			password_confirm: {
				equalTo: "#password"
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
});
