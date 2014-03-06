(function() {
	window.formjsFactory.plugin("bootstrap",function(formjs) {
		
		formjs.bootstrap = {
			showErrors: function() {
				formjs.container.find(".has-error").removeClass("has-error");
				if (formjs.errors.length > 0) {
					_.each(formjs.errors, function(item) {
						item.field.line.line.addClass("has-error");
					});
				}
			},
			resetErrors: function() {
				formjs.container.find(".has-error").removeClass("has-error");
			}
		};
		
	}, {
		description:	"Bootstrap: Utilities to manage bootstrap forms, showing errors for example.",
		version:		1.0,
		author:			"Julien Loutre <julien@twenty-six-medias.com>"
	});
})();