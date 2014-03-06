var _ 					= require('underscore');
var twitter 			= require('ntwitter');


exports.dataProvider = function (Gamify) {

	Gamify.data.twitter = new (function() {
		var scope 				= this;
		
		Gamify.log("Twitter Monitoring started...","");
		
		this.twitter = new twitter({
			consumer_key: 			'HJoENa2IEb5uIxZhMeDA',
			consumer_secret: 		'Pnpve4jxXJxfYS5uFTUN7fybYJVJQX3kCgC1KjIMWto',
			access_token_key: 		'477694698-Y9BbDSByJhIeMvBDvhxWZQ2hDDAl2wytYiadlZ1M',
			access_token_secret: 	'8XaW45lI1780kf5uYgbrTPPCUsJr3FygeJ0LlJQ4wV0Zx'
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
					stream.on('error', function (data) {
						Gamify.log('error!', data);
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
		
		this.mongo	= new Gamify.mongo({database: Gamify.settings.db});
		this.mongo.init(function() {
			//scope.init();
		});

	})();

};