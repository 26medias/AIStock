(function() {
	var component = function(jform, data) {
		this.jform 	= jform;
		this.data 	= data;
		this.value	= [];	// The list can have more than one value (if multiple checkboxes)
		this.onUpdateCallback = function(){};
	}
	// Build the component
	component.prototype.build = function(line) {
		var scope	= this;
		this.line	= line;
		_.each(this.data.list, function(item) {
			var id			= _.uniqueId(scope.data.name);
			var container	= window.formjsFactory.dom("div", line.field);
				container.addClass("checkbox");
			var field		= window.formjsFactory.dom("input", container, true);
				field.type		= "checkbox";
				field = $(field);
				field.attr("id", id);
				field.click(function() {
					if (field.is(':checked')) {
						scope.value.push(item.value);
						scope.value = _.uniq(scope.value);
					} else {
						scope.value = _.without(scope.value, item.value);
					}
					scope.onUpdateCallback();
				});
			var label	= window.formjsFactory.dom("label", container);
				label.html(item.label);
				label.attr('for', id);
		});
		
	}
	// Validate the input
	component.prototype.validate = function(val) {
		if (this.value.length > 0) {
			return true;
		}
		return false;
	}
	// Get/Set value
	component.prototype.val = function(val) {
		if (val && val !== false) {
			this.value = val();
		} else {
			return this.value;
		}
	}
	// Return true if the field has been filled.
	component.prototype.isFilled = function() {
		return this.value.length > 0;
	}
	// Register a callback, called whenever the value changes
	component.prototype.onUpdate = function(callback) {
		this.onUpdateCallback = callback;
	}
	// Register the component
	window.formjsFactory.component("checkbox", component, {
		description:	"A simple checkbox list",
		version:		1.0,
		author:			"Julien Loutre <julien@twenty-six-medias.com>"
	});
})();