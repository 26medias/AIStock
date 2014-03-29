var _ 					= require('underscore');
var twitter 			= require('ntwitter');
var twitter2 			= require('twitter');


exports.dataProvider = function (Gamify) {

	Gamify.data.twitter = new (function() {
		var scope 				= this;
		
		Gamify.log("Twitter Monitoring started...","");
		/*
		this.twitter = new twitter({
			consumer_key: 			'HJoENa2IEb5uIxZhMeDA',
			consumer_secret: 		'Pnpve4jxXJxfYS5uFTUN7fybYJVJQX3kCgC1KjIMWto',
			access_token_key: 		'477694698-Y9BbDSByJhIeMvBDvhxWZQ2hDDAl2wytYiadlZ1M',
			access_token_secret: 	'8XaW45lI1780kf5uYgbrTPPCUsJr3FygeJ0LlJQ4wV0Zx'
		});
		*/
		this.twitter = new twitter({
			consumer_key: 			'kOnytDS8XsUZsk9Cj9p2kA',
			consumer_secret: 		'NrG0cM6tVtCjBorRmoru5bdgfqkVzEO81PhpfRx5Y',
			access_token_key: 		'477694698-wj8yHhyhwe3Tsk7wYTDumFHcJUKP8f1NOYGnz197',
			access_token_secret: 	'TJrlFmzaon5afdu6ABuWoLRxPl5E8nLpKt9XwOood8zRd'
		});
		this.twitter2 = new twitter2({
			consumer_key: 			'kOnytDS8XsUZsk9Cj9p2kA',
			consumer_secret: 		'NrG0cM6tVtCjBorRmoru5bdgfqkVzEO81PhpfRx5Y',
			access_token_key: 		'477694698-wj8yHhyhwe3Tsk7wYTDumFHcJUKP8f1NOYGnz197',
			access_token_secret: 	'TJrlFmzaon5afdu6ABuWoLRxPl5E8nLpKt9XwOood8zRd'
		});
		
		this.streams			= {};
		
		
		this.init		= function() {
			
		}
		
		
		// Start monitoring a keyword for a symbol
		this.monitor = function(keyword, symbol) {
			if (!_.has(scope.streams, symbol)) {
				scope.streams[symbol] 	= {
					keywords:	{}
				};
			}
			if (Gamify.options.monitor) {
				Gamify.log("Monitoring Twitter for symbol "+symbol, keyword);
				
				scope.twitter.stream('statuses/filter', {track:keyword}, function(stream) {
					
					scope.streams[symbol].keywords[keyword] = stream;
					
					stream.on('data', function (data) {
						var object = {
							keyword:	keyword,
							symbol:		symbol,
							text:		data.text,
							created_at:	new Date(data.created_at),
							lang:		data.lang,
							entities:	data.entities
						};
						if (object.text) {
							scope.mongo.insert({
								collection:	'tweets',
								data:		object
							}, function() {});
						}
						
					});
					stream.on('error', function (data, something) {
						Gamify.log('error!', [data, something]);
					});
				});
			}
		}
		
		// Stop the stream for a symbol
		this.stopMonitoring = function(symbol) {
			var i;
			for (i in scope.streams[symbol].keywords) {
				scope.streams[symbol].keywords[i].destroy();
			}
		};
		
		this.search	= function(terms, callback) {
			Gamify.log("Twitter search for ",terms);
			scope.twitter2.search(terms, function(err, data) {
				Gamify.log("Twitter response",data);
				callback(data);
			});
		}
		
		this.mongo	= new Gamify.mongo({database: Gamify.settings.db});
		this.mongo.init(function() {
			//scope.init();
		});

	})();

};