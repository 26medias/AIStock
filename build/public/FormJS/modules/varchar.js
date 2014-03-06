(function() {
	var component = function(jform, data) {
		this.jform 	= jform;
		this.data 	= data;
	}
	// Build the component
	component.prototype.build = function(line) {
		this.line		= line;
		this.field 		= window.formjsFactory.dom("input", line.field, true);
		this.field.type = "varchar";
		this.field 		= $(this.field);
		if (this.data.placeholder) {
			this.field.attr('placeholder',this.data.placeholder);
		}
		this.field.addClass("form-control");
	}
	// Validate the input
	component.prototype.validate = function(val) {
		if (this.val().trim() != "") {
			return true;
		}
		return false;
	}
	// Get/Set value
	component.prototype.val = function(val) {
		if (val && val !== false) {
			this.field.val(val);
		} else {
			return this.field.val();
		}
	}
	// Return true if the field has been filled.
	component.prototype.isFilled = function() {
		return this.val().trim() != "";
	}
	// Register a callback, called whenever the value changes
	component.prototype.onUpdate = function(callback) {
		this.field.bind("change", callback);
	}
	// Register the component
	window.formjsFactory.component("varchar", component, {
		description:	"Varchar, simple input text, single line.",
		version:		1.0,
		author:			"Julien Loutre <julien@twenty-six-medias.com>"
	});
})();