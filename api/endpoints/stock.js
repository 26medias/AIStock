var _ 					= require('underscore');
var qs 					= require("querystring");
var toolset 			= require("toolset");
var needle 				= require('needle');
var quiche 				= require('quiche');
var tradestudio 		= require('tradestudio');
var gimage 				= require('google-image-chart').charts;

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
		
		test: {
			require:		[],
			auth:			false,
			description:	"Returns the list of symbols and keywords",
			params:			{},
			status:			'stable',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				Gamify.data.stock.getHistoricalData(params.symbol, new Date(2014,0,1), new Date(), callback);
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
					limit:	1000,
					types:	["price","ask","bid"]
				}, params);
				
				
				params	= scope.Gamify.api.fixTypes(params, {
					types: 'array'
				});
				
				if (params.tick) {
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
				} else {
					scope.mongo.aggregate({
						collection:	'stocks',
						rules:		[{
								$match:	{
									symbol:	params.symbol
								}
							},{
								$group:	{
									_id: {
										y:	{
											$year:	'$date'
										},
										m:	{
											$month:	'$date'
										},
										d:	{
											$dayOfMonth:	'$date'
										},
										h:	{
											$hour:		'$date'
										}
									},
									ask: {
										$avg: '$ask'
									},
									bid: {
										$avg: '$bid'
									},
									price: {
										$avg: '$price'
									},
									shortRatio: {
										$avg: '$shortRatio'
									},
									pctchange: {
										$avg: '$pctchange'
									}
								}
							}]
					}, function(response) {
						
						var lastDataPoint = response[response.length-1];
						
						var datasets = [];
						
						_.each(params.types, function(point) {
							var stockDataSet = {
								type: 			'area',
								name: 			'$'+params.symbol+"("+point+")",
								pointInterval: 	60*60*1000,
								pointStart: 	new Date(lastDataPoint._id.y,lastDataPoint._id.m-1,lastDataPoint._id.d,lastDataPoint._id.h).getTime(),
								data:			[]
							};
							
							_.each(response, function(item) {
								stockDataSet.data.splice(0,0,item[point]);
							});
							
							datasets.push(stockDataSet);
						});
						
						
						callback(datasets);
					});
				}

			}
		},
		
		analyze: {
			require:		['symbol'],
			auth:			false,
			description:	"Returns the list of symbols and keywords",
			params:			{symbol:'Stock Symbol to analyze, format $SYMBOL'},
			status:			'stable',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				var stack = new Gamify.stack();
				
				var output = {};
				
				// Clean the symbol
				var symbol = params.symbol.toLowerCase();
				
				// First, we need to get the financial data
				stack.add(function(p, cb) {
					// Go back 30 days
					Gamify.data.stock.getHistoricalData(symbol, new Date(new Date().getTime()-(1000*60*60*24*30*12)), new Date(), function(response) {
						output.financial = response;
						cb();
					});
				}, {});
				
				// Now, we get the twitter data
				/*stack.add(function(p, cb) {
					// Go back 30 days
					Gamify.data.twitter.search('$'+params.symbol, function(response) {
						output.tweets = response;
						cb();
					});
				}, {});*/
				
				stack.process(function() {
					
					
					// Convert to the TradeStudio format
					var tradeData 			= tradestudio.utils.fromYahoo(output.financial);
					
					var processed 			= {};
					
					// Cumulative return
					processed.cumulative 	= tradestudio.indicators.cumulativeReturn(tradeData);
					
					// Change
					processed.change 		= tradestudio.indicators.change(tradeData);
					
					/*
					// SMA
					processed.SMA5 			= tradestudio.indicators.SMA(tradeData, {
						period: 5
					});
					processed.SMA10 		= tradestudio.indicators.SMA(tradeData, {
						period: 10
					});
					
					// SMA
					processed.LWMA5 		= tradestudio.indicators.LWMA(tradeData, {
						period: 5
					});
					processed.LWMA10 		= tradestudio.indicators.LWMA(tradeData, {
						period: 10
					});
					*/
					
					// Stochastic
					processed.stochastic 	= tradestudio.indicators.stochastic(tradeData);
					
					// Aroon
					processed.aroon 		= tradestudio.indicators.aroon(tradeData);
					
					// RSI
					processed.RSI 			= tradestudio.indicators.RSI(tradeData);
					
					// DSPO (Two pole smoother - DSP)
					processed.DSPO 			= tradestudio.indicators.DSPOscillator(tradeData, {
						CutoffPeriod:	20
					});
					
					output.processed 		= processed;
					
					
					
					output.images 			= {};
					
					
					
					
					////////////////////////////////////////////
					// 				CHARTS
					////////////////////////////////////////////
					
					/*
					// Candle Chart
					var candleChart = new gimage.candlestick({
						width:	800,
						height:	200
					});
					candleChart.fromYahoo(output.financial);
					output.images.stock 	= candleChart.render();
					*/
					
					// Stock Chart as a line
					var stockChart = new gimage.line({
						width:	800,
						height:	200,
						autoscale:	true
					});
					stockChart.fromYahoo(output.financial);
					output.images.stock 	= stockChart.render();
					
					
					
					
					// Volume Chart
					var volumeChart = new gimage.bar({
						width:	800,
						height:	60
					});
					volumeChart.fromYahoo(output.financial, 'volume');
					output.images.volume 	= volumeChart.render();
					
					
					// Stochastic Chart
					var stochasticChart = new gimage.line({
						width:	800,
						height:	100,
						bands:	[{
							color:	'DDDDDD',
							from:	1,
							to:		0.7
						},{
							color:	'DDDDDD',
							from:	0.3,
							to:		0
						}],
						xlines:	[30,70],
						autoscale:	false
					});
					stochasticChart.fromTradeStudio(processed.stochastic);
					output.images.stochastic 	= stochasticChart.render();
					
					
					
					// Aroon Chart
					var aroonChart = new gimage.line({
						width:	800,
						height:	100,
						bands:	[{
							color:	'DDDDDD',
							from:	1,
							to:		0.7
						},{
							color:	'DDDDDD',
							from:	0.3,
							to:		0
						}],
						xlines:	[30,70],
						autoscale:	false
					});
					aroonChart.fromTradeStudio(processed.aroon);
					output.images.aroon 	= aroonChart.render();
					
					
					// RSI Chart
					var RSIChart = new gimage.line({
						width:	800,
						height:	100,
						xlines:	[30,70],
						autoscale:	false
					});
					RSIChart.fromTradeStudio(processed.RSI);
					output.images.RSI 	= RSIChart.render();
					
					
					// DSP Oscillator (using 2 pole smoother) Chart
					var DSPOChart = new gimage.line({
						width:	800,
						height:	100,
						xlines:	[0]
					});
					DSPOChart.fromTradeStudio(processed.DSPO);
					output.images.DSPO 	= DSPOChart.render();
					
					
					
					
					var chart = quiche('line');
					chart.setTitle('Something with lines');
					chart.addData([3000, 2900, 1500], 'Blah', '008000');
					chart.addData([3100, 2850, 2900], 'Asdf', '0000FF');
					chart.addAxisLabels('x', ['1800', '1900', '2000']);
					chart.setAutoScaling();
					chart.setTransparentBackground();
					
					output.images.quiche = chart.getUrl(true);
					
					
					callback(output);
				}, false);
			}
		},
		
		
		processSignals: {
			require:		['symbol'],
			auth:			false,
			description:	"Process the stock data for use by a Neural Network",
			params:			{symbol:'Stock Symbol to analyze, format SYMBOL', days:	"Number of days to pull."},
			status:			'stable',
			version:		1.2,
			callback:		function(params, req, res, callback) {
				var stack = new Gamify.stack();
				
				params = _.extend({
					days:	12*30
				}, params);
				
				params	= scope.Gamify.api.fixTypes(params, {
					days:		'number'
				});
				
				var output = {
					signals:	{},		// Indicators signals:	[-1;0;1]
					changes:	{},		// Stock price change:	[-1;0;1]
				};
				
				// Clean the symbol
				var symbol = params.symbol.toLowerCase();
				
				// First, we need to get the financial data
				stack.add(function(p, cb) {
					// Go back 30 days
					Gamify.data.stock.getHistoricalData(symbol, new Date(new Date().getTime()-(1000*60*60*24*params.days)), new Date(), function(response) {
						output.financial 	= response;
						
						// Index by date
						output.stock		= _.indexBy(response, function(point) {
							return new Date(point.date).standard();
						});
						cb();
					});
				}, {});
				
				stack.process(function() {
					
					// 
					
					// Convert to the TradeStudio format
					var tradeData 		= tradestudio.utils.fromYahoo(output.financial);
					
					// List the indicators we want to use
					var indicators 		= ['stochastic', 'aroon', 'RSI', 'DSPOscillator'];
					
					// Get the futurePrice data
					var future			= tradestudio.indicators.futurePrices(tradeData, {period:10}, function(v) {
						return new Date(v).standard();
					});
					
					output.future = future;
					
					_.each(indicators, function(indicator) {
						var datasets = tradestudio.indicators[indicator](tradeData);
						
						// Now, we check for each if there are signals in there
						_.each(datasets, function(dataset) {
							if (dataset.signal) {
								//console.log("dataset",dataset);
								// There is a signal function
								_.each(dataset.data, function(datapoint) {
									var signal	= dataset.signal(datapoint[1]);
									var date	= datapoint[0].standard();
									
									if (!output.signals[date]) {
										output.signals[date] = {
											input:	{},
											output:	0
										};
									}
									
									output.signals[date].input[dataset.name] 	= signal;
									if (output.future[date]) {
										output.signals[date].output 			= output.future[date];
									} else {
										output.signals[date].output				= false;
									}
								});
							}
						});
						
						//output.processed[indicator] = datasets;
					});
					
					//delete output.financial;
					
					callback(output);
				}, false);
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