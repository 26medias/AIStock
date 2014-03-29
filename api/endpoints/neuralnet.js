var _ 					= require('underscore');
var qs 					= require("querystring");
var classifier 			= require("classifier");

// Users
function api() {
	
}
api.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify = Gamify;
	
	// Return the methods
	var methods = {
		
		data: {
			require:		['symbol'],
			auth:			false,
			description:	"Get the data fed to the Neural Net",
			params:			{symbol:"Stock Symbol"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				Gamify.data.stock.getHistoricalData(params.symbol, new Date(new Date().getTime()-(1000*60*60*24*35)), new Date(), function(data) {
					callback(data);
				});
			}
		},
	};
	
	// Init a connection
	this.mongo	= new this.Gamify.mongo({database:Gamify.settings.db});
	this.mongo.init(function() {
		callback(methods);
	});
}
exports.api = api;