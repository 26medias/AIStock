var _ 					= require('underscore');
var qs 					= require("querystring");
var classifier 			= require("classifier");

// Users
function api() {
	
}
api.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify = Gamify;
	
	// Return the methods
	var methods = {
		
		getTweets: {
			require:		['symbol','type'],
			auth:			false,
			description:	"List tweets for that symbol",
			params:			{symbol:"Stock Symbol"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				
				var queryObject = {
					symbol:	params.symbol,
					lang:	'en'
				};
				
				var bayes = false;
				
				switch (params.type) {
					case "relevance":
						queryObject.trained = {
							$exists:	false
						};
						bayes = new classifier.Bayesian({
							backend: {
								type: 	'Redis',
								options: {
									hostname: 	'localhost',
									port: 		6379,
									name: 		'symbol_'+params.symbol
								}
							}
						});
					break;
					case "sentiment":
						queryObject.trained = true;
						queryObject.sentiment_trained = {
							$exists:	false
						};
						queryObject.classification = 'relevant';
						
						bayes = new classifier.Bayesian({
							backend: {
								type: 	'Redis',
								options: {
									hostname: 	'localhost',
									port: 		6379,
									name: 		'symbol_sentiment_'+params.symbol
								}
							}
						});
					break;
				}
				
				
				
				params = _.extend({
					page:		1,
					perpage:	10
				}, params);
				
				scope.mongo.paginate({
					collection:	'tweets',
					query:	queryObject,
					page:		params.page,
					perpage:	params.perpage,
					sort:		{
						created_at:	-1
					}
				}, function(response) {
					
					var stack = new Gamify.stack();
					var buffer = [];
					_.each(response.data, function(tweet) {
						stack.add(function(p,cb) {
							if (bayes) {
								bayes.classify(p.tweet.text, function(category) {
									console.log("classified in: " + category);
									p.tweet.estimate	= category;
									buffer.push(p.tweet);
									cb();
								});
							} else {
								buffer.push(p.tweet);
								cb();
							}
						}, {tweet:tweet});
						
					});
					
					stack.process(function() {
						response.data = buffer;
						callback(response);
					}, true);
					
				});
			}
		},
		
		tweetIsRelevant: {
			require:		['_id'],
			auth:			false,
			description:	"Teach the AI that the tweet is relevant for its stock.",
			params:			{symbol:"Stock Symbol"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				// Get the tweet
				var tweet = scope.mongo.find({
					collection:	'tweets',
					query:	{
						_id:	scope.mongo.ObjectId(params._id)
					}
				}, function(response) {
					if (response.length == 0) {
						callback(Gamify.api.errorResponse('Couldn\'t find that tweet.'));
					} else {
						var tweet = response[0];
						var bayes = new classifier.Bayesian({
							backend: {
								type: 	'Redis',
								options: {
									hostname: 	'localhost',
									port: 		6379,
									name: 		'symbol_'+tweet.symbol
								}
							}
						});
						
						bayes.train(tweet.text, 'relevant', function() {
							callback({trained:true});
							
							// Mark the tweet as processed
							scope.mongo.update({
								collection:	'tweets',
								query:	{
									_id:	scope.mongo.ObjectId(params._id)
								},
								data:	{
									$set: {
										trained:		true,
										classification:	'relevant'
									}
								}
							}, function(response) {
								
							});
						});
						
					}
				});
				
			}
		},
		
		tweetIsTrash: {
			require:		['_id'],
			auth:			false,
			description:	"Teach the AI that the tweet is not relevant for its stock.",
			params:			{symbol:"Stock Symbol"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				// Get the tweet
				var tweet = scope.mongo.find({
					collection:	'tweets',
					query:	{
						_id:	scope.mongo.ObjectId(params._id)
					}
				}, function(response) {
					if (response.length == 0) {
						callback(Gamify.api.errorResponse('Couldn\'t find that tweet.'));
					} else {
						var tweet = response[0];
						var bayes = new classifier.Bayesian({
							backend: {
								type: 	'Redis',
								options: {
									hostname: 	'localhost',
									port: 		6379,
									name: 		'symbol_'+tweet.symbol
								}
							}
						});
						
						bayes.train(tweet.text, 'trash', function() {
							callback({trained:true});
							
							// Mark the tweet as processed
							scope.mongo.update({
								collection:	'tweets',
								query:	{
									_id:	scope.mongo.ObjectId(params._id)
								},
								data:	{
									$set: {
										trained:		true,
										classification:	'trash'
									}
								}
							}, function(response) {
								
							});
						});
						
					}
				});
				
			}
		},
		
		tweetIsPositive: {
			require:		['_id'],
			auth:			false,
			description:	"Teach the AI that the tweet is positive for its stock.",
			params:			{symbol:"Stock Symbol"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				// Get the tweet
				var tweet = scope.mongo.find({
					collection:	'tweets',
					query:	{
						_id:	scope.mongo.ObjectId(params._id)
					}
				}, function(response) {
					if (response.length == 0) {
						callback(Gamify.api.errorResponse('Couldn\'t find that tweet.'));
					} else {
						var tweet = response[0];
						var bayes = new classifier.Bayesian({
							backend: {
								type: 	'Redis',
								options: {
									hostname: 	'localhost',
									port: 		6379,
									name: 		'symbol_sentiment_'+tweet.symbol
								}
							}
						});
						
						bayes.train(tweet.text, 'positive', function() {
							callback({trained:true});
							
							// Mark the tweet as processed
							scope.mongo.update({
								collection:	'tweets',
								query:	{
									_id:	scope.mongo.ObjectId(params._id)
								},
								data:	{
									$set: {
										sentiment_trained:	true,
										sentiment:			'positive'
									}
								}
							}, function(response) {
								
							});
						});
						
					}
				});
				
			}
		},
		
		tweetIsNegative: {
			require:		['_id'],
			auth:			false,
			description:	"Teach the AI that the tweet is negative for its stock.",
			params:			{symbol:"Stock Symbol"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				// Get the tweet
				var tweet = scope.mongo.find({
					collection:	'tweets',
					query:	{
						_id:	scope.mongo.ObjectId(params._id)
					}
				}, function(response) {
					if (response.length == 0) {
						callback(Gamify.api.errorResponse('Couldn\'t find that tweet.'));
					} else {
						var tweet = response[0];
						var bayes = new classifier.Bayesian({
							backend: {
								type: 	'Redis',
								options: {
									hostname: 	'localhost',
									port: 		6379,
									name: 		'symbol_sentiment_'+tweet.symbol
								}
							}
						});
						
						bayes.train(tweet.text, 'positive', function() {
							callback({trained:true});
							
							// Mark the tweet as processed
							scope.mongo.update({
								collection:	'tweets',
								query:	{
									_id:	scope.mongo.ObjectId(params._id)
								},
								data:	{
									$set: {
										sentiment_trained:	true,
										sentiment:			'negative'
									}
								}
							}, function(response) {
								
							});
						});
						
					}
				});
				
			}
		},
		
		tweetIsNeutral: {
			require:		['_id'],
			auth:			false,
			description:	"Teach the AI that the tweet is neutral for its stock.",
			params:			{symbol:"Stock Symbol"},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				// Get the tweet
				var tweet = scope.mongo.find({
					collection:	'tweets',
					query:	{
						_id:	scope.mongo.ObjectId(params._id)
					}
				}, function(response) {
					if (response.length == 0) {
						callback(Gamify.api.errorResponse('Couldn\'t find that tweet.'));
					} else {
						var tweet = response[0];
						var bayes = new classifier.Bayesian({
							backend: {
								type: 	'Redis',
								options: {
									hostname: 	'localhost',
									port: 		6379,
									name: 		'symbol_sentiment_'+tweet.symbol
								}
							}
						});
						
						bayes.train(tweet.text, 'neutral', function() {
							callback({trained:true});
							
							// Mark the tweet as processed
							scope.mongo.update({
								collection:	'tweets',
								query:	{
									_id:	scope.mongo.ObjectId(params._id)
								},
								data:	{
									$set: {
										sentiment_trained:	true,
										sentiment:			'neutral'
									}
								}
							}, function(response) {
								
							});
						});
						
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