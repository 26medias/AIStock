var _ 					= require('underscore');
var qs 					= require("querystring");

// Users
function api() {
	
}
api.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify = Gamify;
	
	// Return the methods
	var methods = {
		
		tracked: {
			require:		[],
			auth:			false,
			description:	"Returns the list of symbols and keywords",
			params:			{},
			status:			'stable',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				callback(Gamify.data.stock.tracked);
			}
		}
	};
	
	// Init a connection
	this.mongo	= new this.Gamify.mongo({database:Gamify.settings.db});
	this.mongo.init(function() {
		callback(methods);
	});
}
exports.api = api;