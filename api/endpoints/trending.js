var _ 					= require('underscore');
var qs 					= require("querystring");
var stocktwit_client 	= require("stocktwits_client").main;

// Users
function api() {
	
}
api.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify 		= Gamify;
	
	this.dailyRate		= 200;
	this.fetchInterval	= (24*60*60*1000)/this.dailyRate;	// ms
	
	// Return the methods
	var methods = {
		
		getSymbols: {
			require:		['access_token'],
			auth:			false,
			description:	"Get the list of registered races",
			params:			{access_token:"Stocktwit access_token (requires auth)"},
			status:			'dev',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				
				
				
				var pull = function() {
					Gamify.log("Pulling Trending data from the API...","");
					var stocktwit = new stocktwit_client({
						access_token:	params.access_token
					});
					stocktwit.getTrendingSymbols(params.access_token, function(response) {
						// Save in the cache
						var data = {
							date: 		new Date(),
							symbols:	response.body.symbols
						};
						
						scope.mongo.insert({
							collection:	"trending",
							data:		data
						}, function() {});
						
						callback(response.body.symbols);
					});
				}
				
				if (params.force) {
					pull();
				} else {
					Gamify.log("Checking for a cached version...","");
					// Check if we have a cache
					scope.mongo.find({
						collection:	"trending",
						query:		{
							date:	{
								$gt:	new Date(new Date().getTime()-scope.fetchInterval)
							}
						},
						sort:	{
							date:	-1
						}
					}, function(response) {
						if (response.length == 0) {
							Gamify.log("No valid cache version available.","");
							pull();
						} else {
							Gamify.log("Valid cache version used.",response[0].date);
							callback(response[0].symbols);
						}
					});
				}
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