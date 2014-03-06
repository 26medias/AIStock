(function() {
	window.formjsFactory.plugin("accordion",function(formjs) {
		
		console.log("formjs",formjs);
		
		formjs.createLine = function(data) {
			
			if (!formjs.container.attr('id')) {
				formjs.container.attr('id', _.uniqueId('form'))
			}
			
			var lineid = _.uniqueId('accordion')
			
			var panel 	= window.formjsFactory.dom("div", formjs.container);
				panel.addClass("panel").addClass("panel-default");
			var heading 	= window.formjsFactory.dom("div", panel);
				heading.addClass("panel-heading");
			var title 	= window.formjsFactory.dom("div", heading);
				title.addClass("panel-title");
			var label 	= window.formjsFactory.dom("a", title);
				label.html(data.label);
				label.attr('data-toggle','collapse').attr('data-parent','#'+formjs.container.attr('id')).attr('href','#'+lineid);
				
			var collapse 	= window.formjsFactory.dom("div", panel);
				collapse.addClass("panel-collapse").addClass("collapse");
				collapse.attr('id', lineid);
			var body 	= window.formjsFactory.dom("div", collapse);
				body.addClass("panel-body");
				
			// Return the individual components (DOM nodes)
			return {
				line:	panel,
				label:	label,
				field:	body
			};
		};
		
	}, {
		description:	"Accordion: Display the survey as an accordion",
		version:		1.0,
		author:			"Julien Loutre <julien@twenty-six-medias.com>"
	});
})();