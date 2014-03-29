var _ 					= require('underscore');
var qs 					= require("querystring");
var stocktwit_client 	= require("stocktwits_client").main;

// Users
function api() {
	
}
api.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify = Gamify;
	
	// Return the methods
	var methods = {
		
		getToken: {
			require:		[],
			auth:			false,
			description:	"Get the list of registered races",
			params:			{upcoming:"Bool"},
			status:			'dev',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				var stocktwit = new stocktwit_client();
				stocktwit.getAccessToken(params.code, function(response) {
					callback(response.body);
				});
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