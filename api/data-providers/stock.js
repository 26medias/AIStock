var _ 					= require('underscore');
var finance 			= require('yahoo-finance');


exports.dataProvider = function (Gamify) {

	Gamify.data.stock = new (function() {
		
		var scope = this;
		Gamify.log("Stock Monitoring started...","");
		
		/*
			API tags:
			http://www.gummy-stuff.org/Yahoo-data.htm
		*/
		
		this.tracked = {
			
		};
		
		this.init = function() {
			// Search for the stocks to track
			return true;
			scope.mongo.find({
				collection:	'tracked'
			}, function(response) {
				_.each(response, function(stock) {
					scope.tracked[stock.symbol] = stock.keywords;
				});
				Gamify.log("Tracking", scope.tracked);
				
				var symbol;
				var symbols = [];
				for (symbol in scope.tracked) {
					
					symbols.push(symbol);
					
					// Monitor Twitter for those keywords
					_.each(scope.tracked[symbol], function(keyword) {
						Gamify.data.twitter.monitor(keyword, symbol);
					});
					
				}
				
				// Monitor Yahoo finance for those symbols
				if (Gamify.options.monitor) {
					scope.monitor(symbols);
				}
			});
		};
		
		this.monitor = function(symbols) {
			finance.snapshot({
				symbols: symbols,
				fields: ['s', 'n', 'd1', 'l1', 'c','v','b2','b3','s7']
			}, function (err, data, url, fields) {
				Gamify.log("data", data);
				Gamify.log("fields", fields);
				
				var symbol;
				for (symbol in data) {
					var pctChange = data[symbol]['changeAndPercentChange'].replace(/%/g, '').split(' - ');
					scope.each(pctChange, function(part) {
						return part*1;
					});
					
					// Insert in the database
					scope.mongo.insert({
						collection:	'stocks',
						data:	{
							date:		new Date(),
							symbol:		symbol,
							pctchange:	pctChange[1]/100,	// [0;1]
							ask:		data[symbol]['askRealtime']*1,
							bid:		data[symbol]['bidRealtime']*1,
							price:		data[symbol]['lastTradePriceOnly']*1,
							shortRatio:	data[symbol]['shortRatio']*1
						}
					}, function() {});
					
				}
				
				setTimeout(function() {
					scope.monitor(symbols);
				}, Gamify.options.stockRefreshRate);
			});
		};
		
		
		this.getHistoricalData_old = function(symbol, from, to, callback) {
			
			// Query limit imposed by Yahoo
			var queryLimit = 10;
			
			var queryStack = new Gamify.stack();
			
			// conver the 'from' and 'to' date objects to neutral dates (midnight time)
			from 	= new Date(from.getFullYear(),from.getMonth(),from.getDate());
			to 		= new Date(to.getFullYear(),to.getMonth(),to.getDate());
			
			// Make sure we can query that range (no future date)
			var today 		= new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate());
			var yesterday 	= new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()-1);
			
			if (to.getTime() > yesterday.getTime()) {
				to = yesterday;
				Gamify.log("Range must be changed. max available date: ",yesterday);
			}
			
			// Check what days we need
			var days = (to.getTime()-from.getTime())/(1000*60*60*24);
			
			// List the days
			var timestamp;
			var requiredDates = [];
			for (timestamp=from.getTime();timestamp<=to.getTime();timestamp+=(1000*60*60*24)) {
				var date = new Date(timestamp);
				if (date.getDay() != 6 && date.getDay() != 0) {
					requiredDates.push(date);
				}
			}
			
			var getQuotes = function() {
				scope.mongo.find({
					collection:	"historical",
					query:	{
						date:	{
							$gte:	from,
							$lte:	to
						},
						symbol:	symbol
					},
					sort:	{
						date: 1
					}
				}, function(quotes) {
					callback(quotes);
				});
			}
			
			// Check if we are missing days for that period
			scope.mongo.distinct({
				collection:	"historical",
				key:		"date",
				query:	{
					date:	{
						$in:	requiredDates
					},
					symbol:		symbol
				}
			}, function(dates) {
				// Convert the dates we have to a GTM string
				dates = _.map(dates, function(date) {
					return date.toISOString();
				});
				
				// Now we have the dates that are in the database, we need to find the dates we don't have
				var missingDates = [];
				_.each(requiredDates, function(requiredDate) {
					if (!_.contains(dates, requiredDate.toISOString())) {
						missingDates.push(requiredDate.toISOString());
					}
				});
				
				
				if (missingDates.length > 0) {
					
					Gamify.log("Missing dates!", missingDates);
					
					// Reorder by date
					missingDates = missingDates.sort(function(a,b) {
						return new Date(a).getTime()-new Date(b).getTime();
					});
					
					// Adjust the range
					var from2 	= new Date(missingDates[0]);
					var to2 	= new Date(missingDates[missingDates.length-1]);
					
					// Query for that range
					finance.historical({
						symbol: 	symbol,
						from: 		from2.getFullYear()+'-'+(from2.getMonth()+1)+'-'+from2.getDate(),
						to: 		to2.getFullYear()+'-'+(to2.getMonth()+1)+'-'+to2.getDate(),
					}, function (err, quotes, url, symbol) {
						
						if (quotes && quotes.length>0) {
							// Insert the data if missing
							var stack = new Gamify.stack();
							
							_.each(quotes, function(quote) {
								// Check if we need that date
								if (_.contains(missingDates, quote.date.toISOString())) {
									stack.add(function(p, cb) {
										scope.mongo.insert({
											collection:	"historical",
											data:	_.extend(quote, {indicators:{}})
										}, cb);
									});
								} else {
								}
							});
							
							stack.process(function() {
								getQuotes();
							}, true);	// async
						} else {
							getQuotes();
						}
						
					});
				} else {
					getQuotes();
				}
			});
			
			
		}
		
		
		
		this.getHistoricalData = function(symbol, from, to, callback) {
			
			// Query limit imposed by Yahoo
			var queryLimit = 10;
			
			var queryStack = new Gamify.stack();
			
			symbol = symbol.toLowerCase();
			
			// conver the 'from' and 'to' date objects to neutral dates (midnight time)
			from 	= new Date(from.getFullYear(),from.getMonth(),from.getDate());
			to 		= new Date(to.getFullYear(),to.getMonth(),to.getDate());
			
			// Make sure we can query that range (no future date)
			var today 		= new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate());
			var yesterday 	= new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()-1);
			
			if (to.getTime() > yesterday.getTime()) {
				to = yesterday;
				Gamify.log("Range must be changed. max available date: ",yesterday);
			}
			
			// Check what days we need
			var days = (to.getTime()-from.getTime())/(1000*60*60*24);
			
			// List the days
			var timestamp;
			var requiredDates = [];
			for (timestamp=from.getTime();timestamp<=to.getTime();timestamp+=(1000*60*60*24)) {
				var date = new Date(timestamp);
				if (date.getDay() != 6 && date.getDay() != 0) {
					requiredDates.push(date);
				}
			}
			
			
			// Split required dates in group of queryLimit (10)
			var dateGroups 	= [];
			var nGroups		= Math.ceil(requiredDates.length/queryLimit);
			var i;
			for (i=0;i<nGroups;i++) {
				dateGroups.push(requiredDates.slice(i*queryLimit, i*queryLimit+queryLimit));
			}
			
			// Get quotes from the DB
			var getQuotes = function() {
				scope.mongo.find({
					collection:	"historical",
					query:	{
						date:	{
							$gte:	from,
							$lte:	to
						},
						symbol:	symbol,
						$or:	[{
							available:	{
								$exists:	false
							}
						},{
							available:	true
						}]
					},
					sort:	{
						date: 1
					}
				}, function(quotes) {
					callback(quotes);
				});
			}
			
			
			// Check if we are missing days for that period
			scope.mongo.distinct({
				collection:	"historical",
				key:		"date",
				query:	{
					symbol:		symbol
				}
			}, function(dates) {
				
				
				Date.prototype.standard = function() {
					return this.getFullYear()+"-"+(this.getMonth()+1)+"-"+this.getDate();
				}
				
				// Convert the dates we have to a GTM string
				dates = _.map(dates, function(date) {
					return date.standard();
				});
				
				// Now we have the dates that are in the database, we need to find the dates we don't have
				var missingDates = [];
				_.each(requiredDates, function(requiredDate) {
					if (!_.contains(dates, requiredDate.standard())) {
						missingDates.push(requiredDate.standard());
					}
				});
				
				/*
				callback({
					dates:			dates,
					missingDates:	missingDates,
					requiredDates:	requiredDates
				});
				return false;
				*/
				
				if (missingDates.length > 0) {
					
					_.each(dateGroups, function(dateGroup) {
						
						var run = false;
						_.each(dateGroup, function(date) {
							if (_.contains(missingDates, date.standard())) {
								run = true;
							}
						});
						if (run) {
							queryStack.add(function(p, cb) {
								
								var from2 	= new Date(dateGroup[0]);
								var to2 	= new Date(dateGroup[dateGroup.length-1]);
								
								Gamify.log("Pulling from yahoo ",{from:from2,to:to2});
								
								// Query for that range
								finance.historical({
									symbol: 	symbol,
									from: 		from2.getFullYear()+'-'+(from2.getMonth()+1)+'-'+from2.getDate(),
									to: 		to2.getFullYear()+'-'+(to2.getMonth()+1)+'-'+to2.getDate(),
								}, function (err, quotes, url, symbol) {
									console.log("Yahoo responded...",quotes.length);
									
									
									if (quotes && quotes.length>0) {
										
										// Now we check for dates not available
										var availableDates = [];
										_.each(quotes, function(quote) {
											availableDates.push(new Date(quote.date).standard());
										});
										
										var unavailableDates = [];
										_.each(dateGroup, function(date) {
											if (!_.contains(availableDates, date.standard())) {
												unavailableDates.push(date);
											}
										});
										Gamify.log("Unavailable Dates", unavailableDates);
										
										
										
										// Insert the data if missing
										var stack = new Gamify.stack();
										
										_.each(quotes, function(quote) {
											// Check if we need that date
											stack.add(function(p2, cb2) {
												scope.mongo.update({
													collection:	"historical",
													query:	{
														date:	new Date(quote.date)
													},
													data:	{
														$set:	_.extend(quote, {indicators:{}})
													}
												}, function() {
													cb2();
												});
											});
										});
										
										
										// Mark the unavaible dates as unavailable, not ask again
										_.each(unavailableDates, function(unavailableDate) {
											stack.add(function(p2, cb2) {
												
												scope.mongo.update({
													collection:	"historical",
													query:	{
														date:	new Date(unavailableDate)
													},
													data:	{
														$set:	{
															date:		new Date(unavailableDate),
															available:	false,
															symbol:		symbol
														}
													}
												}, function() {
													cb2();
												});
											});
										})
										
										stack.process(function() {
											cb();
										}, true);	// async
									} else {
										cb();
									}
									
								});
							}, {});
						}
					});
					
					queryStack.process(function() {
						getQuotes();
					}, false);	// sync, just to see better during debug
					
				} else {
					getQuotes();
				}
			});
		}
		
		
		
		
		// Utility
		this.each = function(array, callback) {
			var i;
			var l = array.length;
			for (i=0;i<l;i++) {
				array[i] = callback(array[i]);
			}
		};
		
		
		
		
		this.mongo	= new Gamify.mongo({database: Gamify.settings.db});
		this.mongo.init(function() {
			scope.init();
			console.log("Connected to ",Gamify.settings.db);
		});

	})();

};