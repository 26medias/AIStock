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
		
		track: {
			require:		['symbol','keywords'],
			auth:			false,
			description:	"Start tracking a symbol",
			params:			{symbol:"Stock Symbol", keyword: "Array of keywords"},
			status:			'dev',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				
				params = Gamify.api.fixTypes(params, {
					keywords:	'array'
				});
				
				if (!_.isArray(params.keywords)) {
					callback(Gamify.api.errorResponse('You need to provide an array of keywords.'));
					return false;
				}
				
				
				scope.mongo.update({
					collection:	'tracked',
					query:	{
						symbol:	params.symbol
					},
					data: {
						$set: {
							symbol:	params.symbol
						},
						$addToSet:	{
							keywords:	{
								$each: params.keywords
							}
						}
					}
				}, function() {
					// Get the data
					scope.mongo.find({
						collection:	'tracked',
						query:	{
							symbol:	params.symbol
						}
					}, function(response) {
						if (response.length == 0) {
							callback(Gamify.api.errorResponse('There was an issue inserting the new data in the database. Please try again.'));
						} else {
							callback(response[0]);
						}
					});
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