var _ 					= require('underscore');
var qs 					= require("querystring");
var classifier 			= require("classifier");
var brain 				= require("brain");
var gimage 				= require('google-image-chart').charts;

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
			params:			{symbol:"Stock Symbol",type:'relevance/sentiment',perpage:'Tweets per page',page:'Page to show',group:'Bool: Group by found classfication'},
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
						
						if (params.group) {
							response = _.groupBy(response.data, function(tweet) {
								return tweet.estimate;
							});
						}
						
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
		
		stock: {
			require:		['symbol','name'],
			auth:			false,
			description:	"Train the AI to understand a stock",
			params:			{symbol:"Stock Symbol",retrain:"Retrain the network",days:"How many days of data",trainingDataPct:"Number between 0 and 1. Represent the percentage of data used for Training."},
			status:			'stable',
			version:		1.0,
			callback:		function(params, req, res, callback) {
				
				params = _.extend({
					trainingDataPct:	0.7,
					days:				12*30
				}, params);
				
				// Get the training data
				scope.Gamify.api.execute("stock","processSignals", {
					symbol:		params.symbol,
					days:		params.days
				}, function(RawSignals) {
					
					var data = [];
					var date;
					for (date in RawSignals.signals) {
						if (RawSignals.signals[date].output) {
							data.push(RawSignals.signals[date]);
						}
					}
					
					// Cut the data into training and test data
					var trainingDataLength 	= Math.round(data.length*params.trainingDataPct);
					
					var trainingData 		= data.slice(0, trainingDataLength);
					var testData 			= data.slice(trainingDataLength);
					
					Gamify.log("Training Data", 	trainingData.length);
					Gamify.log("Test Data", 		testData.length);
					
					var testNetwork = function(neural, testData, cb) {
						
						if (!cb) {
							cb = callback;
						}
						
						console.log("\n\n*** Testing Neural Net ***\n\n");
						var output = [];
						var c = 0;
						
						var tscore	= 0;
						var tn		= 0;
						var twscore	= 0;	// Weighted score
						var twn		= 0;	// Weighted count
						
						var accuracyData = {
							regular:	[],
							weighted:	[]
						}
						
						_.each(testData, function(point) {
							if (point.output) {
								var response = neural.run(point.input);
								// Compare to the known output
								var score	= 0;
								var n		= 0;
								var wscore	= 0;	// Weighted score
								var wn		= 0;	// Weighted count
								var i;
								for (i in response) {
									var r = Math.round(response[i]);
									if (r == point.output[i]) {
										score++;
										wscore += 10-(i*1);
										tscore++;
										twscore += 10-(i*1);
									}
									n++;
									wn += 10-(i*1);
									tn++;
									twn += 10-(i*1);
								}
								output.push({
									response:	response,
									known:		point.output,
									score:		Math.round(score/n*100)+"%",
									wscore:		Math.round(wscore/wn*100)+"%"
								});
								accuracyData.regular.push(Math.round(score/n*100));
								accuracyData.weighted.push(Math.round(wscore/wn*100));
							}
						});
						
						console.log("\n\n*** OVERALL ACCURACY: \t"+Math.round(tscore/tn*100)+"%"+" ***");
						console.log("*** WEIGHTED ACCURACY: \t"+Math.round(twscore/twn*100)+"%"+" ***\n\n");
						
						
						
						// Generate a chart
						var accuracyChart = new gimage.line({
							width:	500,
							height:	300,
							xlines:	[50,70,80,90],
							autoscale:	true
						});
						accuracyChart.fromArray(accuracyData);
						var chart 	= accuracyChart.render();
						
						
						cb({
							score:		Math.round(tscore/tn*100)+"%",
							wscore:		Math.round(twscore/twn*100)+"%",
							chart:		chart,
							output:		output
						});
					}
					
					
					
					
					
					
					
					
					// Check if there is already a net
					scope.mongo.find({
						collection:	'neuralnets',
						query:	{
							name:	params.name
						}
					}, function(response) {
						if (response.length == 0 || params.retrain) {
							// Train!
							// Now we train
							var net 				= new brain.NeuralNetwork();
							
							var trainResponse		= net.train(trainingData);
							Gamify.log("Training Response", trainResponse);
							
							// Now we save the neural net
							scope.mongo.update({
								collection:	'neuralnets',
								query:	{
									name:	params.name
								},
								data:	{
									$set:	{
										name:	params.name,
										net:	net.toJSON()
									}
								}
							}, function(err, response) {
								console.log("\n\n*** Partial Neural net saved as '"+params.name+"' ***");
								
								// test the network
								testNetwork(net, testData, function(testResponse) {
									// train on the most recent data, the test sample
									var trainResponse		= net.train(testData);
									Gamify.log("Remaining Training Response", trainResponse);
									
									// Now we save the neural net
									scope.mongo.update({
										collection:	'neuralnets',
										query:	{
											name:	params.name
										},
										data:	{
											$set:	{
												name:	params.name,
												net:	net.toJSON()
											}
										}
									}, function(err, response) {
										console.log("\n\n*** Full Neural net saved as '"+params.name+"' ***");
										callback(testResponse);
									});
								});
								
							});
							
						} else {
							
							console.log("\n\n*** Neural loaded from '"+params.name+"' ***");
							
							// Load from the database
							var net 				= new brain.NeuralNetwork();
							var neural 				= net.fromJSON(response[0].net);
							
							testNetwork(neural, testData);
						}
					});
					
					
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