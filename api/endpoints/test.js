var _ 					= require('underscore');
var qs 					= require("querystring");
var classifier 			= require("classifier");
var brain 				= require("brain");
var gimage 				= require('google-image-chart').charts;
var ts 					= require("timeseries-analysis");
var ml 					= require('machine_learning');

// Users
function api() {
	
}
api.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify = Gamify;
	
	// Return the methods
	var methods = {
		
		test: {
			require:		['symbol'],
			auth:			false,
			description:	"Test the timeseries-analysis lib",
			params:			{symbol:"Stock Symbol"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				
				params = _.extend({
					symbol:		'FB',
					days:		400
				}, params);
				
				Gamify.data.stock.getHistoricalData(params.symbol, new Date(new Date().getTime()-(1000*60*60*24*params.days)), new Date(), function(response) {
					var t 		= new ts.main(ts.adapter.fromDB(response));
					
					
					var data_map = function (x, in_min, in_max, out_min, out_max) {
						return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
					}
					
					
					// Prepare the ML inputs and outputs
					var inputs 		= [];
					var outputs 	= [];
					var data 		= [];
					var buffer 		= [];
					// sliding window
					var i;
					var l = response.length;
					var n = 10;
					for (i=n;i<l;i++) {
						
						buffer = [];
						// Include everything to get the minimum, then slice to remove the expected output
						for (j=1;j<n;j++) {
							buffer.splice(0,0,response[i-j].close);
						}
						
						var min = _.min(buffer);
						var max = _.max(buffer);
						
						data.push({
							input:	buffer,
							output:	[data_map(response[i].close,min,max,0,1)]
						});
					}
					
					Gamify.service.brain.train({
						data:		data,
						threshold:	0.05
					}, function(response) {
						callback(response);
					});
					
					
					
					
					/*
					// The AI part
					var classifier = new ml.LogisticRegression({
						'input' : 	inputs,
						'label' : 	outputs,
						'n_in' : 	n,
						'n_out' : 	1
					});
					classifier.set('log level',1);
					
					classifier.train({
						'lr': 		800,
						'epochs': 	0.01
					});
					
					// Forecasting
					var forecasts	= [];
					var l2 = response.length;
					for (i=l;i<l2;i++) {
						buffer = [];
						// Include everything to get the minimum, then slice to remove the expected output
						for (j=0;j<n;j++) {
							buffer.splice(0,0,response[i-j].close);
						}
						
						// Now, we normalize
						var min = _.min(buffer);
						var max = _.max(buffer);
						
						buffer = _.map(buffer, function(val) {
							return data_map(val,min,max,0,1);
						});
						
						
						forecasts.push({
							input:		buffer.slice(0,n),
							expected:	buffer[buffer.length-1],
							prediction:	classifier.predict(buffer.slice(0,n))
						});
					}
					
					callback({
						inputs:		inputs,
						outputs:	outputs,
						//forecasts:	forecasts,
						chart:		t.chart(),
						outliers: 	t.outliers({threshold:1.8})
					});
					*/
					
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