var _ 					= require('underscore');
var file 				= require('./file.js').main;
var stack 				= require('./stack.js').main;

function api(Gamify) {
	
	Gamify.data 	= {};	// data providers will need this var
	Gamify.service 	= {};	// services will need this var
	this.Gamify 	= Gamify;
}
api.prototype.init = function(callback) {
	var scope 			= this;
	this.endpoints 		= {};
	this.authmethods 	= {};
	this.outputs 		= {};
	
	var scanStack	= new stack();
	
	// List the endpoints map the methods
	scanStack.add(function(params, onProcessed) {
		file.listFiles("./api/endpoints","js", function(endpoints) {
			var i;
			var m;
			
			
			
			
			var subStack	= new stack();
			
			console.log("\n**********************************");
			console.log("*****       APIs found       *****");
			
			for (i=0;i<endpoints.length;i++) {
				var includepath				= endpoints[i].substr(0,endpoints[i].length-3);
				var	parts					= includepath.split("/");
				var urlpath					= parts[parts.length-1];
				var apiClass 				= require('../../'+includepath).api;
				subStack.add(function(params, onProcessed) {
					(new params.apiClass()).init(scope.Gamify, function(methods) {
						scope.endpoints[params.urlpath] 	= {};
						console.log("++ "+params.urlpath);
						for (m in methods) {
							console.log(
								(methods[m].auth?'\033[31m':'\033[32m')+
								scope.Gamify.utils.pad(
									m,
								24)+
								(methods[m].auth ? '\033[35m'+
								scope.Gamify.utils.pad(
									'['+methods[m].auth+']',
								16)+ '\033[31m' : scope.Gamify.utils.pad("",16)+'\033[32m')+
								(methods[m].require.length==0?'':" \033[33m["+methods[m].require.join(', ')+"]")+'\033[0m');
							scope.endpoints[params.urlpath][m] = methods[m];
						}
						onProcessed();
					});
				}, {urlpath:urlpath,apiClass:apiClass});
			}
			
			subStack.process(function() {
				onProcessed();
			}, true);
		});
	},{});
	
	// List the auth methods
	scanStack.add(function(params, onProcessed) {
		file.listFiles("./api/auth","js", function(authmethods) {
			var i;
			var m;
			for (i=0;i<authmethods.length;i++) {
				var includepath				= authmethods[i].substr(0,authmethods[i].length-3);
				var	parts					= includepath.split("/");
				var urlpath					= parts[parts.length-1];
				var authClass 				= require('../../'+includepath).auth;
				(new authClass()).init(scope.Gamify, function(methods) {
					
					console.log("\n**********************************");
					console.log("*****   Auth methods found   *****");
					console.log("++ "+urlpath);
					for (m in methods) {
						console.log("-- "+m);
						scope.authmethods[m] = methods[m];
					}
					onProcessed();
				});
			}
		});
	},{});
	
	// List the output methods
	scanStack.add(function(params, onProcessed) {
		file.listFiles("./api/output","js", function(outputs) {
			var i;
			var m;
			console.log("\n**********************************");
			console.log("***** Output formaters found *****");
			for (i=0;i<outputs.length;i++) {
				var includepath				= outputs[i].substr(0,outputs[i].length-3);
				var	parts					= includepath.split("/");
				var urlpath					= parts[parts.length-1];
				var method 					= require('../../'+includepath).output;
				scope.outputs[urlpath]		= method;
				console.log("-- "+urlpath);
			}
			console.log("");
			onProcessed();
		});
	},{});
	
	
	// List the hooks
	scanStack.add(function(params, onProcessed) {
		file.listFiles("./api/hooks","js", function(outputs) {
			var i;
			var m;
			for (i=0;i<outputs.length;i++) {
				var includepath				= outputs[i].substr(0,outputs[i].length-3);
				// Simply execute the hooks.
				var incl					= require('../../'+includepath).hooks;
				if (incl) {
					incl(scope.Gamify);
				}
			}
			onProcessed();
		});
	},{});
	
	
	// List the validators
	scanStack.add(function(params, onProcessed) {
		file.listFiles("./api/validators","js", function(outputs) {
			var i;
			var m;
			for (i=0;i<outputs.length;i++) {
				var includepath				= outputs[i].substr(0,outputs[i].length-3);
				// Simply execute the hooks.
				var incl					= require('../../'+includepath).validators;
				incl(scope.Gamify);
			}
			onProcessed();
		});
	},{});
	
	
	// List the data providers
	scanStack.add(function(params, onProcessed) {
		file.listFiles("./api/data-providers","js", function(outputs) {
			var i;
			var m;
			for (i=0;i<outputs.length;i++) {
				var includepath				= outputs[i].substr(0,outputs[i].length-3);
				// Simply execute the hooks.
				var incl					= require('../../'+includepath).dataProvider;
				incl(scope.Gamify);
			}
			onProcessed();
		});
	},{});
	
	
	// List the data services
	scanStack.add(function(params, onProcessed) {
		file.listFiles("./api/services","js", function(outputs) {
			var i;
			var m;
			for (i=0;i<outputs.length;i++) {
				var includepath				= outputs[i].substr(0,outputs[i].length-3);
				// Simply execute the hooks.
				var incl					= require('../../'+includepath).service;
				incl(scope.Gamify);
			}
			onProcessed();
		});
	},{});
	
	// Process the stack, async
	scanStack.process(callback, false);
}
api.prototype.execute = function(endpoint, method, data, callback, format, req, res) {
	
	var scope 	= this;
	var error	= false;
	var errorResponse;
	
	// Default output format
	if (!format) {
		format = 'json';
	}
	
	//console.log("execute()",endpoint, method, data, format);
	
	if (!this.endpoints[endpoint]) {
		console.log("No such endpoint: ",endpoint);
		// Create an error response
		errorResponse 	= this.errorResponse("No such endpoint.");
		error		= true;
	}
	if (this.endpoints[endpoint] && !this.endpoints[endpoint][method]) {
		console.log("No such method: ",endpoint+'.'+method);
		// Create an error response
		errorResponse 	= this.errorResponse("No such method: ",endpoint+'.'+method);
		error		= true;
	}
	
	if (!error) {
		// Do we have validators?
		scope.Gamify.validator.trigger(endpoint, method, data, function(modifiedData) {
			
			var apiMethod = function(params) {
				//console.log("executing \033[32m"+endpoint+"."+method+"\033[0m with parameters:",params);
				scope.endpoints[endpoint][method].callback(params, req, res, function(response) {
				
					// Do we have hooks?
					scope.Gamify.hook.trigger(endpoint, method, modifiedData, response, function(modifiedResponse) {
						if (res) {
							scope.outputs[format](modifiedResponse, res, modifiedData);
						}
						if (callback) {
							callback(modifiedResponse);
						}
					});
				});
			};
			
			// Do we have all the required parameters?
			var hasParameters = scope.Gamify.api.require(modifiedData, scope.endpoints[endpoint][method].require);
			if (hasParameters !== true) {
				if (res) {
					scope.outputs[format](hasParameters, res, modifiedData);
				}
				if (callback) {
					callback(hasParameters);
				}
				return false;
			}
			
			// Is that an auth API?
			if (!scope.endpoints[endpoint][method].auth) {
				// If an authtoken is given anyway
				if (modifiedData.authtoken) {
					// Try to auth the user
					scope.authmethods.authtoken(modifiedData, function(valid, response) {
						if (valid !== false) {
							modifiedData.__auth 		= valid;
							modifiedData.__authcheck 	= scope.Gamify.settings.systoken;
						}
						// call the method
						apiMethod(modifiedData);
					});
				} else {
					// Execute the API
					apiMethod(modifiedData);
				}
			} else {
				// Authenticate the user
				if (!scope.authmethods[scope.endpoints[endpoint][method].auth]) {
					console.log("No such auh method: ",scope.endpoints[endpoint][method].auth);
					if (res) {
						scope.outputs[format](scope.errorResponse("No such auh method: "+scope.endpoints[endpoint][method].auth), res, modifiedData);
					}
					if (callback) {
						callback(scope.errorResponse("No such auh method: "+scope.endpoints[endpoint][method].auth));
					}
				} else {
					//console.log("executing \033[32m"+endpoint+"."+method+"\033[0m with parameters:",modifiedData);
					scope.authmethods[scope.endpoints[endpoint][method].auth](modifiedData, function(valid, response) {
						console.log("AUTH",valid);
						if (valid !== false) {
							modifiedData.__auth = valid;
							apiMethod(modifiedData);
						} else {
							//console.log(response);
							if (res) {
								scope.outputs[format](_.extend({invalid_token:true},scope.errorResponse(response)), res, modifiedData);
							}
							if (callback) {
								callback(_.extend({invalid_token:true},scope.errorResponse(response)));
							}
						}
					});
				}
			}
			
		});
		
		
	} else {
		if (res) {
			scope.outputs[format](errorResponse, res, data);
		}
		if (callback) {
			callback(errorResponse);
		}
	}
	
}
api.prototype.require = function(params, required) {
	var missing = [];
	var i;
	for (i in required) {
		if (!params[required[i]] && params[required[i]] !== false && params[required[i]] !== 0) {
			missing.push(required[i]);
		}
	}
	if (missing.length > 0) {
		return this.errorResponse('Missing parameters: '+missing.join(', '));
	} else {
		return true;
	}
}
api.prototype.fixTypes = function(params, types) {
	var i;
	for (i in params) {
		if (types[i]) {
			switch (types[i]) {
				case "object":
					if (typeof params[i] != 'object') {
						try {
							params[i] = JSON.parse(params[i]);
						} catch(e) {
							
						}
					}
				break;
				case "array":
					if (!_.isArray(params[i])) {
						try {
							params[i] = JSON.parse(params[i]);
						} catch(e) {
							params[i] = [];
						}
					}
				break;
				case "md5":
					params[i] = this.Gamify.crypto.md5(params[i].toString());
				break;
				case "date":
					params[i] = new Date(params[i]*1000);
				break;
				case "bool":
					switch (params[i]) {
						case "yes":
						case "true":
						case "1":
						case 1:
							params[i] = true;
						break;
						case "no":
						case "false":
						case "0":
						case 0:
							params[i] = false;
						break;
					}
				break;
				case "int":
				case "number":
					params[i] = params[i]*1;
				break;
				default:
					if (!isNaN(params[i]*1) && params[i] != null && params[i] != '') {
						params[i] = params[i]*1;
					}
				break;
			}
		} else {
			// Try to convert ints to ints.
			if (!isNaN(params[i]*1) && params[i] != null && params[i] != '' && params[i] !== true && params[i] !== false) {
				params[i] = params[i]*1;
			}
		}
	}
	return params;
}
api.prototype.fixBool = function(params) {
	var i;
	for (i in params) {
		if (typeof params[i] == "object") {
			params[i] = this.fixBool(params[i]);
		} else { 
			switch (params[i]) {
				case "yes":
				case "true":
					params[i] = true;
				break;
				case "no":
				case "false":
					params[i] = false;
				break;
			}
			if (!isNaN(params[i]*1) && params[i] != null && params[i] != '' && params[i] !== true && params[i] !== false) {
				params[i] = params[i]*1;
			}
		}
	}
	
	return params;
}
api.prototype.groupAggregates = function(aggregates, rules) {
	var output = {};
	var type;
	var label;
	for (type in aggregates) {
		if (rules[type]) {
			output[type] = {};
			// there's a rule for that aggregation
			/*
			0,
			[1,5],
			[6,10],
			[11,20]
			[21,false]
			*/
			_.each(rules[type], function(rule) {
				if (_.isArray(rule)) {
					if (rule[1] !== false) {
						var newlabel = rule[0]+"-"+rule[1];
					} else {
						var newlabel = rule[0]+"+";
					}
				} else {
					// number
					var newlabel = rule;
				}
				output[type][newlabel] = 0;
				
				
				
				for (label in aggregates[type]) {
					// Convert to int
					var intlabel = label*1;
					
					if (_.isArray(rule)) {
						if (rule[1] !== false) {
							if (intlabel >= rule[0] && intlabel <= rule[1]) {
								output[type][newlabel]+= aggregates[type][label];
							}
						} else {
							if (intlabel >= rule[0]) {
								output[type][newlabel]+= aggregates[type][label];
							}
						}
					}
					if (!_.isArray(rule)) {
						// number, not range
						if (intlabel == rule) {
							output[type][newlabel]+= aggregates[type][label];
						}
						// handle "null" = 0
						if (label == "null") {
							if (!output[type][0]) {
								output[type][0] = 0;
							}
							output[type][0] += aggregates[type][label];
						}
						
					}
				}
			});
			
		} else {
			output[type] = aggregates[type];
		}
	}
	
	return output;
}
api.prototype.filter = function(params, allowed) {
	var i;
	var inArray = function(array, item) {
		var i;
		var l = array.length;
		for (i=0;i<l;i++) {
			if (array[i] == item) {
				return true;
			}
		}
		return false;
	}
	var output = {};
	for (i in params) {
		if (inArray(allowed, i)) {
			output[i] = params[i];
		}
	}
	return output;
}
api.prototype.errorResponse = function(message, errorNumber, data) {
	if (!errorNumber) {
		var errorNumber = 0;
	}
	
	return {
		error:	_.extend(data?{data: data}:{},{
			number:		errorNumber,
			message:	message
		})
	};
}

exports.main = api;