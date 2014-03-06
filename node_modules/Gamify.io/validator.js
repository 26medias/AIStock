var _ 					= require('underscore');
var uuid 				= require('./uuid');

function validator(Gamify) {
	this.Gamify 	= Gamify;
	this.validators	= {};
}

validator.prototype.register = function(endpoint, method, callback) {
	if (!this.validators[endpoint]) {
		this.validators[endpoint] = {};
	}
	if (!this.validators[endpoint][method]) {
		this.validators[endpoint][method] = callback;
	} else {
		console.log("******* WARNING *******\n\tYou have more than one validator assigned to "+endpoint+"."+method+"!");
	}
}

validator.prototype.trigger = function(endpoint, method, data, callback) {
	
	if (!this.validators[endpoint]) {
		callback(data);
		return false;
	}
	if (!this.validators[endpoint][method]) {
		callback(data);
		return false;
	}
	this.validators[endpoint][method](data, callback);
}

exports.main = validator;
