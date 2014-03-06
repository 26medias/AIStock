(function() {
	var component = function(jform, data) {
		this.jform 	= jform;
		this.data 	= data;
		this.value	= "";
		this.onUpdateCallback = function(){};
	}
	// Build the component
	component.prototype.build = function(line) {
		var scope	= this;
		this.line	= line;
		var gid		= _.uniqueId(scope.data.name);
		
		_.each(this.data.list, function(item) {
			var id			= _.uniqueId(scope.data.name);
			var container	= window.formjsFactory.dom("div", line.field);
				container.addClass("radio");
			var field		= window.formjsFactory.dom("input", container, true);
				field.type		= "radio";
				field = $(field);
				field.attr("id", 	id);
				field.attr("name", 	gid);
				field.attr("value", item.value);
				field.click(function() {
					scope.onUpdateCallback();
				});
			var label	= window.formjsFactory.dom("label", container);
				label.html(item.label);
				label.attr('for', id);
		});
		
	}
	// Validate the input
	component.prototype.validate = function(val) {
		if (this.val() && this.val() != "") {
			return true;
		}
		return false;
	}
	// Get/Set value
	component.prototype.val = function(val) {
		if (val && val !== false) {
			this.value = val();
		} else {
			return this.line.field.find('input[type=radio]:checked').val();
		}
	}
	// Return true if the field has been filled.
	component.prototype.isFilled = function() {
		return this.val() && this.val() != "";
	}
	// Register a callback, called whenever the value changes
	component.prototype.onUpdate = function(callback) {
		this.onUpdateCallback = callback;
	}
	// Register the component
	window.formjsFactory.component("radio", component, {
		description:	"Radio, simple radio list",
		version:		1.0,
		author:			"Julien Loutre <julien@twenty-six-medias.com>"
	});
})();