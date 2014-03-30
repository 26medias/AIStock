var _ 					= require('underscore');
var qs 					= require("querystring");
var classifier 			= require("classifier");
var brain 				= require("brain");

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
		
		
		forecast: {
			require:		['symbol','name'],
			auth:			false,
			description:	"Forecast the price direction using the Neural Net",
			params:			{symbol:"Stock Symbol", name:"Name of the Neural Net in the db"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				
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
	};
	
	// Init a connection
	this.mongo	= new this.Gamify.mongo({database:Gamify.settings.db});
	this.mongo.init(function() {
		callback(methods);
	});
}
exports.api = api;