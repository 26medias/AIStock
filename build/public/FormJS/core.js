(function() {
	var formjsFactory = function() {
		this.components 	= {};
		this.plugins 		= {};
	};
	// Register a new question type
	formjsFactory.prototype.component = function(name, factory, about) {
		if (this.components[name]) {
			console.info("/!\ Module '"+name+"' is already defined. Duplicate:", about);
			this.formErrors.push("/!\ Module '"+name+"' is already defined.");
			return false;
		} else {
			this.components[name] = factory;
			return true;
		}
	};
	// Register a new plugin
	formjsFactory.prototype.plugin = function(name, data, about, overwrite) {
		if (this.plugins[name] && !overwrite) {
			console.info("/!\ Plugin '"+name+"' is already defined. Duplicate:", about);
			this.formErrors.push("/!\ Plugin '"+name+"' is already defined.");
			return false;
		} else {
			this.plugins[name] = data;
			return true;
		}
	};
	// Utility, to create new dom elements
	formjsFactory.prototype.dom = function(nodeType, appendTo, raw) {
		var element = document.createElement(nodeType);
		if (appendTo != undefined) {
			$(appendTo).append($(element));
		}
		return (raw === true)?element:$(element);
	};
	
	
	var formjs = function(container, plugins) {
		this.fields		= {};
		this.data		= {};
		this.errors		= [];
		this.formErrors = [];
		if (plugins) {
			this.use		= plugins;
		} else {
			this.use		= [];
		}
		
		this.container 	= container;
		
		// What DOM element and classname are used for the structure of the form
		this.theme		= {
			line:	{
				classname:	"form-group",
				type:		"div"
			},
			label:	{
				classname:	"control-label",
				type:		"label"
			},
			field:	{
				classname:	false,
				type:		"div"
			},
		};
		var scope = this;
		
		// Import the plugins
		_.each(this.use, function(pluginName) {
			console.log("Loading ",pluginName);
			if (window.formjsFactory.plugins[pluginName]) {
				// Executre the plugin, pass as an argument the formjs instance
				window.formjsFactory.plugins[pluginName](scope);
			} else {
				console.error("/!\ Plugin '"+pluginName+"' is missing.");
				this.formErrors.push("Plugin '"+pluginName+"' is missing.");
			}
		});
		/*
		var plugin;
		for (plugin in window.formjsFactory.plugins) {
			//if (this[plugin]) {
			//	console.error("/!\ Plugin '"+plugin+"' was refused. This name is either already in use internally or already registered by another plugin.");
			//	this.formErrors.push("Plugin '"+plugin+"' was refused. This name is either already in use internally or already registered by another plugin.");
			//} else {
				this[plugin] = window.formjsFactory.plugins[plugin](this);
				console.log("Plugin '"+plugin+"' has been installed.", this[plugin]);
			//}
		}
		*/
		
		// Conditionnal Framework, used to write easy display conditions in the form.
		this.conditionFramework = function(fieldName) {
			if (!scope.fields[fieldName]) {
				console.error("/!\ Condition: field '"+fieldName+"' desn't exist.");
				scope.formErrors.push("Condition: field '"+fieldName+"' desn't exist.");
				return this;
			}
			this.field 	= scope.fields[fieldName];
			return this;
		}
		this.conditionFramework.prototype.equal = function(value) {
			if (!this.field) {
				console.error("/!\ Condition: No field selected.");
				scope.formErrors.push("Condition: No field selected.");
				return false;
			}
			if (!this.field.active) {
				return false;
			}
			if (this.field.instance.validate() && this.field.instance.val() == value) {
				return true;
			}
			return false;
		}
		this.conditionFramework.prototype.contains = function(value) {
			if (!this.field) {
				console.error("/!\ Condition: No field selected.");
				scope.formErrors.push("Condition: No field selected.");
				return false;
			}
			if (!this.field.active) {
				return false;
			}
			var scope = this;
			if (_.isArray(value)) {
				if (!scope.field.instance.validate()) {
					return false;
				}
				var ok = true;
				_.each(value, function(val) {
					ok &= _.contains(scope.field.instance.val(),val);
				});
				return ok;
			} else {
				if (this.field.instance.validate() && _.contains(this.field.instance.val(),value)) {
					return true;
				}
			}
			return false;
		}
	};
	// Build the form
	formjs.prototype.build = function(options) {
		
		var scope = this;
		
		this.options 	= _.extend({
			form:		{},
			submit:		$(),
			onSubmit:	function() {},
			onError:	function() {},
			onInit:		function() {}
		}, options);
		
		_.each(this.options.form, function(item) {
			if (item.condition && typeof item.condition == "string") {
				// If the condition is a string (to be able to save in a database for example), we need to parse it. We don't want to polute the current scope, so we create a new scope using an anonymous function.
				(function(item) {
				    item.condition = new Function("scope", "with(scope){return "+ item.condition + ";}")(this);
				})(item);
			}
			
			if (scope.fields[item.name]) {
				console.info("/!\ field '"+item.name+"' is already defined. Duplicate:", scope.fields[item.name]);
				scope.formErrors.push("field '"+item.name+"' is already defined.");
				return this;
			} else {
				if (!window.formjsFactory.components[item.type]) {
					console.info("/!\ factory '"+item.type+"' doesn't exist on ", item);
					scope.formErrors.push("factory '"+item.type+"' doesn't exist.");
					return this;
				} else {
					// Create a new instance of the question type
					var instance 		= new window.formjsFactory.components[item.type](scope, item);
					// Create a new line (HTML form line)
					var line = scope.createLine(item);
					// Build the field in that line
					instance.build(line);
					// Setup the update event
					// When a field is updated, the conditions are checked again to show/hide the proper questions.
					instance.onUpdate(function() {
						scope.executeConditions();
					});
					// Create the object
					scope.fields[item.name] 	= {
						factory:	window.formjsFactory.components[item.type],
						instance:	instance,
						data:		item,
						line:		line,
						active:		true	// Active (visible) by default
					};
					// But hide by default.
					// When the form is built, the conditions will be checked and display the questions that need to be displayed with a pretty animation.
					line.line.hide();
				}
				return this;
			}
		});
		
		// Setup the click event on the submit button
		this.options.submit.unbind('click').bind('click',function() {
			scope.submit();
		});
		
		// Check the conditions on the questions
		this.executeConditions();
		
		scope.options.onInit(this);
		
		return this;
	};
	// validating the form
	formjs.prototype.submit = function() {
		// If the form validates (all of the questions), we call onSubmit(), else onError()
		if (this.validate()) {
			this.options.onSubmit(this.data, this);	// scope.data is filled by validate(), and is a serialized object that contains the answers to the form.
		} else {
			this.options.onError(this.errors, this);	// scope.errors is filled by validate(), and list the questions that are not validating.
		}
	};
	// validating the form
	formjs.prototype.validate = function(data) {
		// We simply call the validate() method for each question, and return true only if all of the visible (active) questions are validating.
		var i;
		this.data 	= {};
		this.errors = [];
		var error = false;
		for (i in this.fields) {
			if (this.fields[i].active) {
				
				
				if (this.fields[i].instance.isFilled()) {
					if (this.fields[i].instance.validate()) {
						// Filled, and validating. Pass.
						this.data[i] = this.fields[i].instance.val();
					} else {
						// Filled and not validating. Error.
						error |= true;
						this.errors.push({
							field:		this.fields[i],
							name:		i
						});
					}
				} else {
					if (this.fields[i].data.required) {
						// Not filled, and required. Error.
						error |= true;
						this.errors.push({
							field:		this.fields[i],
							name:		i
						});
					} else {
						// Not filled and not required. Pass. Do nothing.
					}
				}
				/*
				if (this.fields[i].data.required || (!this.fields[i].data.required && this.fields[i].instance.val() != 0)) {
					// That field is required
					if (this.fields[i].instance.validate()) {
						this.data[i] = this.fields[i].instance.val();
					} else {
						error |= true;
						this.errors.push({
							field:		this.fields[i],
							name:		i
						});
					}
				} else {
					// This field is not required
					// But if there's a value, we want it to validate
					
				}*/
			}
		}
		if (error) {
			return false;
		} else {
			return true;
		}
	};
	// Execute the conditions
	formjs.prototype.executeConditions = function() {
		var i;
		// We will count the number of changes (show->hide or hide->show) triggered by the call.
		// If there were changes, then we'll re-execute the function, until there are no more changes.
		var changes	= 0;
		for (i in this.fields) {
			if (this.fields[i].data.condition) {
				if (this.fields[i].data.condition(this.conditionFramework)) {
					if (this.fields[i].active != true) {
						changes++;
						this.fields[i].active	= true;
						this.fields[i].line.line.slideDown();
					}
				} else {
					if (this.fields[i].active != false) {
						changes++;
						this.fields[i].active	= false;
						this.fields[i].line.line.slideUp();
					}
				}
			} else {
				this.fields[i].line.line.slideDown();
			}
		}
		// If there were updates, just keep going.
		if (changes > 0) {
			this.executeConditions();
		}
	};
	// Create a form line (DOM), based on the theme (this.theme)
	formjs.prototype.createLine = function(data) {
		var line 	= window.formjsFactory.dom(this.theme.line.type, this.container);
		if (this.theme.line.classname) {
			line.addClass(this.theme.line.classname);
		}
		var label 	= window.formjsFactory.dom(this.theme.label.type, line);
			label.html(data.label);
		if (this.theme.label.classname) {
			label.addClass(this.theme.label.classname);
		}
		var field 	= window.formjsFactory.dom(this.theme.field.type, line);
		if (this.theme.field.classname) {
			field.addClass(this.theme.field.classname);
		}
		// Return the individual components (DOM nodes)
		return {
			line:	line,
			label:	label,
			field:	field
		};
	};
	// Stringify the form data in JSON, including the functions (conditions).
	// Useful to save the form in a database for example
	formjs.prototype.stringify = function(format) {
		var output = [];
		_.each(this.options.form, function(field) {
			var fieldcopy = _.extend({}, field); // We make a deep-copy of the object
			if (fieldcopy.condition && typeof fieldcopy.condition != "string") {
				// We are converting the condition functions into a string, then removing all the comments from it and finally, we remove all the extra whitespaces.
				fieldcopy.condition = fieldcopy.condition.toString().replace(/\/\*[.\r\n\t\w\W\s]*\*\//, '').replace(/\/\/(.*)[\r\n]/gm, '').replace(/[\t\r\n]/gm, '');
			}
			output.push(fieldcopy);
		});
		// Format the output?
		if (format) {
			return JSON.stringify(output, null, 4);
		} else {
			return JSON.stringify(output);
		}
	};
	
	// Global scope
	window.formjsFactory = new formjsFactory();
	window.formjs 		= formjs;
})();