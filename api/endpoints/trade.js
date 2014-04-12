var _ 					= require('underscore');
var qs 					= require("querystring");
var classifier 			= require("classifier");
var brain 				= require("brain");
var ts 					= require("timeseries-analysis");
var gimage 				= require('google-image-chart').charts;
var Rainbow 			= require('google-image-chart').colors;

// Gonna need that
Date.prototype.standard = function() {
	return this.getFullYear()+"-"+(this.getMonth()+1)+"-"+this.getDate();
}

// Users
function api() {
	
}
api.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify = Gamify;
	
	// Return the methods
	var methods = {
		
		
		slice: {
			require:		['symbol'],
			auth:			false,
			description:	"Forecast the price direction using the Neural Net",
			params:			{symbol:"Stock Symbol", name:"Name of the Neural Net in the db"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				
				params = _.extend({
					symbol:		'FB',
					days:		30,
					until:		10,
					smoothing:	5,
					noise:		5
				}, params);
				
				Gamify.data.stock.getHistoricalData(params.symbol, new Date(new Date().getTime()-(1000*60*60*24*params.days)), new Date(), function(response) {
					//callback(response);
					//return false;
					var output = [];
					
					var t 		= new ts.main(ts.adapter.fromDB(response));
					t.smoother({period:params.smoothing});
					
					callback({
						chart:		t.chart({
							width:	750,
							height:	280,
							main:true
						})	
					});
				});
			}
		},
		
		
		simtrade: {
			require:		['symbol'],
			auth:			false,
			description:	"Forecast the price direction using the Neural Net",
			params:			{symbol:"Stock Symbol", name:"Name of the Neural Net in the db"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				
				params = _.extend({
					symbol:		'FB',
					days:		30,
					smoothing:	5,
					noise:		5
				}, params);
				
				Gamify.data.stock.getHistoricalData(params.symbol, new Date(new Date().getTime()-(1000*60*60*24*params.days)), new Date(), function(response) {
					//callback(response);
					//return false;
					var output 		= [];
					
					var history 	= [];	// Oscillator value history (there is a redraw)
					var actions		= [];	// Actions taken
					
					var stats		= {
						profit:		0,
						gain:		0
					};
					
					var actionMarkers = [];
					
					var buffer		= {
						action:	false,
						price:	false,
						date:	false
					};
					
					var profitChart	= [];
					var cummulativeProfits	= 0;
					
					var n;
					var l = response.length;
					for (n=5;n<l;n++) {
						// Slice the data to the current sim day
						var data 		= response.slice(0, n);
						
						// Analyse the data, removing the noise and using the oscillator as a signal
						var t 			= new ts.main(ts.adapter.fromDB(data));
						var datapoints	= t.reset().smoother({period:params.smoothing}).osc().smoother({period:params.noise}).output();
						
						// Check if there was a cross-over
						var last		= datapoints.length-1;
						var t0			= datapoints[last][1];
						var h0			= history[history.length-1];
						// Push the value to the history
						history.push(t0);
						
						
						if (h0 > 0 && t0 < 0) {
							// Sell!
							
							if (buffer.action == 'buy') {
								
								buffer.action	= "sell";
								
								var profit		= response[n].close-buffer.price;
								var pctprofit	= profit/response[n].close*100;
								
								stats.profit	+= profit;
								stats.gain		+= pctprofit;
								
								actions.push({
									buy:	{
										date:	buffer.date,
										price:	buffer.price
									},
									sell:	{
										date:	response[n].date,
										price:	response[n].close
									},
									profit:	{
										value:	profit,
										pct:	pctprofit
									},
									chart:	t.chart({
										width:		250,
										height:		40,
										main:		false,
										lines:		[0]
									})
								});
								cummulativeProfits += profit;
								profitChart.push(cummulativeProfits);
								
								actionMarkers.push({
									color:	'FF0000',
									point:	n,
									serie:	1
								});
								
							}
						}
						
						if (h0 < 0 && t0 > 0) {
							// Buy!
							
							if (buffer.action != 'buy') {
								
								buffer.action	= "buy";
								buffer.date		= response[n].date;
								buffer.price	= response[n].close;
								
								actionMarkers.push({
									color:	'22B254',
									point:	n,
									serie:	1
								});
								
							}
							
						}
					}
					
					// Generate the profit chart
					var tprofit 	= new ts.main(ts.adapter.fromArray(profitChart));
					
					Gamify.log("profitChart", profitChart);
					Gamify.log("tprofit", ts.adapter.fromArray(profitChart));
					
					stats.chart		= tprofit.chart({
						width:		250,
						height:		40,
						main:		false,
						lines:		[0]
					});
					
					// Generate the trading chart (complete chart with positions displayed)
					var ttrading 	= new ts.main(ts.adapter.fromDB(response));
					ttrading.smoother({period:params.smoothing});
					
					
					callback({
						actions:	actions,
						stats:		stats,
						markers:	actionMarkers,
						chart:		ttrading.chart({
							width:		750,
							height:		280,
							main:		true,
							points:		actionMarkers
						})
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