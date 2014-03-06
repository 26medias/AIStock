var _ 					= require('underscore');
var stack 				= require('./stack.js').main;
var uuid 				= require('./uuid');

function hook(Gamify) {
	this.Gamify 	= Gamify;
	this.hooks		= {};
	this.modifiers	= {};
}

hook.prototype.register = function(endpoint, method, callback) {
	if (!this.hooks[endpoint]) {
		this.hooks[endpoint] = {};
	}
	if (!this.hooks[endpoint][method]) {
		this.hooks[endpoint][method] = [];
	}
	this.hooks[endpoint][method].push({
		uuid:		uuid.v4(),
		callback:	callback
	});
}

hook.prototype.registerModifier = function(endpoint, method, callback) {
	if (!this.modifiers[endpoint]) {
		this.modifiers[endpoint] = {};
	}
	if (!this.modifiers[endpoint][method]) {
		this.modifiers[endpoint][method] = callback;
	} else {
		console.log("******* WARNING *******\n\tYou have more than one modifier assigned to "+endpoint+"."+method+"!");
	}
}

hook.prototype.trigger = function(endpoint, method, params, response, callback) {
	
	//console.log("****** Hooks:\n",this.hooks[endpoint][method]);
	
	var i;
	var l
	// Process Hooks
	if (this.hooks[endpoint] && this.hooks[endpoint][method]) {
		l 						= this.hooks[endpoint][method].length;
		var hookStack			= new stack();
		var hookResponseStack	= new stack();
		
		for (i=0;i<l;i++) {
			this.hooks[endpoint][method][i].callback(params, response);
		}
	}
	
	
	// Process Modifiers
	
	if (!this.modifiers[endpoint]) {
		callback(response);
		return false;
	}
	if (!this.modifiers[endpoint][method]) {
		callback(response);
		return false;
	}
	this.modifiers[endpoint][method](response, function(modifiedResponse) {
		callback(modifiedResponse);
	});
	
	
}

exports.main = hook;
