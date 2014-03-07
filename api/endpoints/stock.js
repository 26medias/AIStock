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
		},
		
		chart: {
			require:		['symbol'],
			auth:			false,
			description:	"Return the financial data",
			params:			{symbol:'Stock symbol', type:'ask|pctchange',limit:'limit'},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				
				params = _.extend({
					type:	'ask',
					limit:	1000
				}, params);
				
				scope.mongo.find({
					collection:	'stocks',
					query:	{
						symbol:	params.symbol
					},
					sort:	{
						date:	-1
					},
					limit:	1000
				}, function(response) {
					
					var lastDataPoint = response[response.length-1];
					
					var datasets = [];
					
					var stockDataSet = {
						type: 			'area',
						name: 			'$'+params.symbol,
						pointInterval: 	Gamify.options.stockRefreshRate,
						pointStart: 	lastDataPoint.date.getTime(),
						data:			[]
					};
					
					_.each(response, function(item) {
						stockDataSet.data.splice(0,0,item[params.type]);
					});
					
					datasets.push(stockDataSet);
					
					callback(datasets);
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