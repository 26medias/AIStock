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
		
		get_registered: {
			require:		[],
			auth:			"authtoken",
			description:	"Get the list of registered races",
			params:			{upcoming:"Bool"},
			status:			'dev',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				
				// Get the count
				scope.mongo.distinct({
					collection:	'userlogs',
					query:		{
						uid:		params.__auth,
						action:		"race.register"
					},
					key:		"race"
				}, function(races) {
					
					var query = {};
					
					if (params.upcoming) {
						query = {
							start_time: {
								$gt:	new Date(new Date().getTime()-(5*60*1000))	// Up to 5min ago
							}
						};
					}
					
					scope.Gamify.api.execute("race","paginate", {
						__auth:			params.__auth,
						query: _.extend({
							alias: {
								$in: races
							}
						},query)
					}, callback);
					
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