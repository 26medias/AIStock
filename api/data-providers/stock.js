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
				fields: ['s', 'n', 'd1', 'l1', 'c','v','b2']
			}, function (err, data, url, fields) {
				Gamify.log(symbol, data);
				
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
							pctchange:	pctChange[1]/100,	// [0;1]
							symbol:		symbol,
							ask:		data[symbol]['askRealtime']*1
						}
					}, function() {});
					
				}
				
				setTimeout(function() {
					scope.monitor(symbols);
				}, Gamify.options.stockRefreshRate);
			});
		};
		
		// Utility
		this.each = function(array, callback) {
			var i;
			var l = array.length;
			for (i=0;i<l;i++) {
				array[i] = callback(array[i]);
			}
		};
		/*
		finance.snapshot({
			symbols: ['AAPL', 'GOOG', 'FB'],
			fields: ['s', 'n', 'd1', 'l1', 'c','v','b2']
		}, function (err, data, url, symbol) {
			Gamify.log(symbol, data);
		});
		*/
		this.mongo	= new Gamify.mongo({database: Gamify.settings.db});
		this.mongo.init(function() {
			scope.init();
		});

	})();

};