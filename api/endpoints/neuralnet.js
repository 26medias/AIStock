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
		
		test: {
			require:		['symbol'],
			auth:			false,
			description:	"Get the data fed to the Neural Net",
			params:			{symbol:"Stock Symbol"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				
				
				params	= scope.Gamify.api.fixTypes(params, {
					days:		'number',
					indicators:	'array',
					train:		'bool'
				});
				
				params = _.extend({
					days:		12*30,
					nnready:	true,
					indicators:	['stochastic', 'aroon', 'RSI', 'DSPOscillator']
				}, params);
				
				scope.Gamify.api.execute("stock","getNeuralData", {
					symbol:		params.symbol,
					nnready:	true,
					days:		params.days,
					indicators:	params.indicators,
					output:		params.output
				}, function(nnSignal) {
					if (params.train) {
						Gamify.service.brain.train({
							data:	nnSignal
						}, function(response) {
							callback(response);
						});
					} else {
						callback(nnSignal);
					}
				});
				
			}
		},
		
		
		forecast: {
			require:		['symbol','name'],
			auth:			false,
			description:	"Forecast the price direction using the Neural Net",
			params:			{symbol:"Stock Symbol", name:"Name of the Neural Net in the db"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				
				params.name = params.name.toLowerCase();
				
				scope.mongo.find({
					collection:	'neuralnets',
					query:	{
						name:	params.name
					}
				}, function(response) {
					if (response.length == 0) {
						console.log("\n**** This Neural Net ("+params.name+") doesn't exist! ****\n");
						callback(Gamify.api.errorResponse("This Neural Net ("+params.name+") doesn't exist."));
					} else {
						
						console.log("\n\n*** Neural loaded from '"+params.name+"' ***");
						
						// Load from the database
						var net 				= new brain.NeuralNetwork();
						var neural 				= net.fromJSON(response[0].net);
						
						// Get the technical analysis
						scope.Gamify.api.execute("stock","processSignals", {
							symbol:		params.symbol,
							days:		30
						}, function(RawSignals) {
							
							// Get the last 5 last datapoints
							scope.mongo.find({
								collection:	"historical",
								query:		{
									symbol:		params.symbol.toLowerCase()
								},
								sort:	{
									date:	-1
								},
								limit:	5
							}, function(stockData) {
								
								
								var indexed = _.indexBy(stockData, function(item) {
									return new Date(item.date).standard();
								});
								
								var output		= [];
								
								var minDate 	= 1000000000000000000000000000;
								var lastDate	= new Date(stockData[0].date).getTime();
								
								
								var date;
								for (date in indexed) {
									// Check if we have input for this point
									if (RawSignals.signals[date]) {
										output.push({
											data:	indexed[date],
											input:	RawSignals.signals[date].input,
											output:	neural.run(RawSignals.signals[date].input)
										});
										if (new Date(indexed[date].date).getTime() < minDate) {
											minDate = new Date(indexed[date].date).getTime();
										}
									} else {
										console.log("No data for date ",date);
									}
								}
								
								Gamify.log("minDate",new Date(minDate));
								Gamify.log("lastDate",new Date(lastDate));
								
								output = output.sort(function(a,b) {
									return new Date(a.data.date).getTime()-new Date(b.data.date).getTime();
								});
								
								// We that we have the output, we can calculate the probabilities, using a weigted average
								var forecasts = {};
								var i;
								for (i=0;i<output.length;i++) {
									var n;
									for (n in output[i].output) {
										var dayNumber = i+(n*1);
										if (!forecasts[dayNumber]) {
											forecasts[dayNumber] = {
												n:	0,
												wn:	0,
												t:	0,
												wt:	0
											};
										}
										forecasts[dayNumber].n	+= 1;
										forecasts[dayNumber].t	+= Math.round(output[i].output[n]);
										
										forecasts[dayNumber].wn += i+1;
										forecasts[dayNumber].wt += (i+1)*Math.round(output[i].output[n]);
									}
								}
								
								var n;
								for (n in forecasts) {
									forecasts[n] = {
										regular:	Math.round(forecasts[n].t/forecasts[n].n*100),
										weighted:	Math.round(forecasts[n].wt/forecasts[n].wn*100)
									};
								}
								
								// Now we transform the day numbers into JS dates
								var dayForecasts 	= [];
								var shift 			= 0;	// Keep track of the shifts in days, due to closed days
								for (n in forecasts) {
									
									var date = new Date(minDate+(1000*60*60*24*(n*1+1)));
									
									// Is that a closed day?
									// Skip Saturdays and Sundays
									if (date.getDay() == 6) {
										// Saturday
										shift += 2;
										var date = new Date(minDate+(1000*60*60*24*((shift+n*1)+3)));
									} else if (date.getDay() == 0) {
										// Saturday
										shift += 1;
										var date = new Date(minDate+(1000*60*60*24*((shift+n*1)+2)));
									}
									
									if (date.getTime() > lastDate) {
										var direction	= "";
										var from		= 0;
										var to			= 0;
										
										if (forecasts[n].regular >= 51 && forecasts[n].weighted >= 51) {
											
											direction	= "up";
											from		= Math.min(forecasts[n].regular, forecasts[n].weighted);
											to			= Math.max(forecasts[n].regular, forecasts[n].weighted);
											
										} else if (forecasts[n].regular <= 51 && forecasts[n].weighted <= 51) {
											
											direction	= "down";
											from		= Math.min(100-forecasts[n].regular, 100-forecasts[n].weighted);
											to			= Math.max(100-forecasts[n].regular, 100-forecasts[n].weighted);
											
										} else {
											direction	= "unknown";
											from		= Math.min(forecasts[n].regular, 100-forecasts[n].weighted);
											to			= Math.max(forecasts[n].regular, 100-forecasts[n].weighted);
										}
										
										
										dayForecasts.push({
											date:		date,
											from:		from,
											to:			to,
											direction:	direction
										});
									}
								}
								
								dayForecasts = dayForecasts.sort(function(a, b) {
									return new Date(a.date).getTime() - new Date(b.date).getTime();
								});
								
								callback(dayForecasts);
							});
							
						});
						/*
						var response 		= neural.run(point.input);
						callback(response);*/
					}
				});
			}
		},
		
		
		test2: {
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
					threshold:	10,
					grid:		40
				}, params);
				
				Gamify.log("params", params);
				
				Gamify.data.stock.getHistoricalData(params.symbol, new Date(new Date().getTime()-(1000*60*60*24*params.days)), new Date(), function(response) {
					//callback(response);
					//return false;
					var output = [];
					
					
					var t_stats 	= new ts.main(ts.adapter.fromDB(response));
					
					// Find the supports and resistances
					var t_high 		= new ts.main(ts.adapter.fromDB(response, {use:'high'}));
					var t_low 		= new ts.main(ts.adapter.fromDB(response, {use:'low'}));
					var supports 	= t_low.supports({
						threshold:	params.threshold,
						grid:		params.grid,
						stats:		true
					});
					var resistances = t_high.supports({
						threshold:	params.threshold,
						grid:		params.grid,
						stats:		true
					});
					
					var t 		= new ts.main(ts.adapter.fromDB(response));
					
					// Support/resistance chart
					var chart = new gimage.line({
						width:	800,
						height:	200,
						bands:	[],
						xlines:	[],
						autoscale:	true
					});
					chart.fromTimeseries(t.output());
					var sup_res_lines = [];
					
					var supp_ress_min = Math.min(_.min(_.map(supports, function(item) { return item.count; })), _.min(_.map(resistances, function(item) { return item.count; })));
					var supp_ress_max = Math.max(_.max(_.map(supports, function(item) { return item.count; })), _.max(_.map(resistances, function(item) { return item.count; })));
					
					// Create the color range
					var rainbow 	= new Rainbow();
					rainbow.setSpectrum("4AA7D9","C75C5C");
					rainbow.setNumberRange(supp_ress_min, supp_ress_max);
					
					// Add supports
					_.each(supports, function(item) {
						sup_res_lines.push({
							name:	"supp_"+item.price,
							data:	[[new Date(),item.price],[new Date(),item.price]],
							color:	rainbow.colorAt(item.count)
						});
					});
					_.each(resistances, function(item) {
						sup_res_lines.push({
							name:	"ress_"+item.price,
							data:	[[new Date(),item.price],[new Date(),item.price]],
							color:	rainbow.colorAt(item.count)
						});
					});
					chart.fromTradeStudio(sup_res_lines);
					/*output.push({
						name:	'Supports/resistances',
						chart:	chart.render()
					});*/
					
					/*
					var t 		= new ts.main(ts.adapter.geometric({}));
					
					t.reset().regression_forecast({forecast:15});
					output.push({
						name:	'Sin',
						chart:	t.chart({main:true})
					});
					/*t.reset().cycle({period:1, forecast:120});
					output.push({
						name:	'Angle',
						chart:	t.chart({main:true,lines:[0],points:[{color:'ff0000',point:120,serie:0},{color:'ff0000',point:140,serie:0}]})
					});
					*/
					
					
					
					var t 		= new ts.main(ts.adapter.fromDB(response));
					t.ARMaxEntropy();
					t.ARLeastSquare();
					output.push({
						name:	'Trend',
						chart:	t.chart({main:false,lines:[0]})
					});
					
					
					
					
					// Testing the save function
					var t 			= new ts.main(ts.adapter.fromDB(response));
					t.smoother({period:10}).save('smooth').reset().lwma({period:10}).smoother({period:5}).save('signal');
					output.push({
						name:	'Multi-set',
						chart:	t.chart({main:false})
					});
					
					
					
					
					var t 			= new ts.main(ts.adapter.fromDB(response));
					t.smoother({period:10});
					output.push({
						name:	'Noise Cancelation',
						chart:	t.chart({main:true})
					});
					t.reset().smoother({period:10}).noiseData();
					output.push({
						name:	"Signal's noise",
						chart:	t.chart({main:false, lines:[0]})
					});
					t.reset().smoother({period:10}).noiseData().smoother({period:4});
					output.push({
						name:	"Signal's smoothed noise",
						chart:	t.chart({main:false, lines:[0]})
					});
					t.reset().smoother({period:10}).osc().smoother({period:10});
					output.push({
						name:	"Trend",
						chart:	t.chart({main:false, lines:[0]})
					});
					
					
					var t 		= new ts.main(ts.adapter.fromDB(response));
					var lwma	= t.lwma({period: 14}).output();
					output.push({
						name:	'lwma',
						chart:	t.chart({main:true})
					});
					
					var t 		= new ts.main(ts.adapter.fromDB(response));
					var dsp_itrend	= t.dsp_itrend().output();
					output.push({
						name:	'dsp_itrend',
						chart:	t.chart({main:true})
					});
					
					var t 		= new ts.main(ts.adapter.fromDB(response));
					t.dsp_itrend({use:'trigger'});
					output.push({
						name:	'dsp_itrend_s',
						chart:	t.chart({main:true})
					});
					
					var t 			= new ts.main(ts.adapter.fromDB(response));
					t.pixelize();
					output.push({
						name:	'pixelize',
						chart:	t.chart({main:true})
					});
					
					callback({
						charts:			output,
						stats:	{
							min:		t_stats.min(),
							max:		t_stats.max(),
							mean:		t_stats.mean(),
							stdev:		t_stats.stdev()
						},
						supports:		supports,
						resistances:	resistances
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