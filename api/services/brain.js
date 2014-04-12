var _ 					= require('underscore');
var classifier 			= require("classifier");
var brain 				= require("brain");
var gimage 				= require('google-image-chart').charts;

exports.service = function (Gamify) {
	
	Gamify.service.brain = new (function() {
		
		console.log("Brain Service loaded.");
		
		
		var scope 			= this;
		var loaded			= false;
		
		
		this.train	= function(options, callback) {
			options = _.extend({
				data:		[],
				ratio:		0.9,		// Training/testing ratio
				open:		false,		// Open a saved network if it exists
				save:		false,		// Save the network,
				topology:	"auto",		// "auto", array or false (default)
				rate:		false,		// Learning rate
				threshold:	0.001,		// Error threshold
				chart:		true,		// Training chart accuracy
				test:		{			// Can be false for no data testing
					binaryOutput:	true,	// if true, then output will be considered on the range [0;1] and forecasts will be then rounded.
					weighted:		true	// outputs are weighted. Requires an index.
				}
			}, options);
			
			if (options.data.length <= 10) {
				callback(Gamify.api.ErrorResponse("There is not enough data to train the Neural Net."));
				return false;
			}
			
			// Cut the data into training and test data
			var trainingDataLength 	= Math.round(options.data.length*options.ratio);
			
			var trainingData 		= options.data.slice(0, trainingDataLength);
			var testData 			= options.data.slice(trainingDataLength);
			
			Gamify.log("Training Data", 	trainingData.length);
			Gamify.log("Test Data", 		testData.length);
			
			var neuralNetOptions	= {};
			
			if (options.topology === false) {
				// default options
			} else if (options.topology == "auto") {
				// Calculate the 2N+1 topology
				// First, find the number of inputs
				var inputNumber = _.keys(options.data[0].input).length;
				Gamify.log("inputNumber",inputNumber);
				neuralNetOptions.hiddenLayers	= [inputNumber*2+1, inputNumber*2+1]
			} else {
				// Custom topology
				neuralNetOptions.hiddenLayers 	= options.topology;
			}
			
			if (options.rate) {
				neuralNetOptions.learningRate	= options.rate;
			}
			
			
			
			var trainNetwork = function(neural) {
				scope._train({
					threshold:	options.threshold,
					neural:		neural,
					data:		trainingData
				}, function(trainResponse) {
					// trainResponse.net
					// trainResponse.output
					
					
					
					if (options.save) {
						scope.mongo.update({
							collection:	'neuralnets',
							query:	{
								name:	options.save
							},
							data:	{
								$set:	{
									name:		options.save,
									net:		trainResponse.net,
									output:		trainResponse.output,
									updated:	new Date()
								}
							}
						}, function(err, response) {
							console.log("\n\n*** Neural net saved as '"+options.save+"' ***");
							// test
							
							scope._test(_.extend({},options.test,{
								data:	testData,
								neural:	neural
							}), function(testResponse) {
								callback({
									training:	trainResponse,
									testing:	testResponse
								});
							});
						});
					} else {
						// test
						scope._test(_.extend({},options.test,{
							data:	testData,
							neural:	neural
						}), function(testResponse) {
							callback({
								training:	trainResponse,
								testing:	testResponse
							});
						});
					}
					
				});
			}
			
			
			
			// Create/load the neural net
			if (options.open) {
				scope.mongo.find({
					collection:	'neuralnets',
					query:	{
						name:	options.open
					}
				}, function(response) {
					if (response.length == 0) {
						console.log("\n**** This Neural Net ("+options.open+") doesn't exist! ****\n");
						
						// Creating a new one
						var neural 				= new brain.NeuralNetwork(neuralNetOptions);
				
						trainNetwork(neural);
						
					} else {
						
						console.log("\n\n*** Neural loaded from '"+options.open+"' ***");
						
						// Load from the database
						var net 				= new brain.NeuralNetwork();
						var neural 				= net.fromJSON(response[0].net);
						
						trainNetwork(neural);
						
					}
				});
			} else {
				var neural 				= new brain.NeuralNetwork(neuralNetOptions);
				
				trainNetwork(neural);
				
			}
			
			
		};
		
		this._train	= function(options, callback) {
			
			options = _.extend({
				data:			[],
				threshold:		0.001
			},options);
			
			if (!options.neural) {
				Gamify.log("!!!! _train requires a neural net implementation to be passed!");
				return false;
			}
			
			var trainResponse		= options.neural.train(options.data, {
				errorThresh: options.threshold
			});
			Gamify.log("Training Response", trainResponse);
			
			callback({
				net:		options.neural.toJSON(),
				output:		trainResponse
			});
			
		}
		
		this._test = function(options, callback) {
			
			options = _.extend({
				data:			[],
				binaryOutput:	true,	// if true, then output will be considered on the range [0;1] and forecasts will be then rounded.
				weighted:		true	// if true, then the outputs are weighted by order: 1=weight 10, 10 = weight 1. Required outputs'keys to be ints representing the order.
			},options);
			
			if (!options.neural) {
				Gamify.log("!!!! _test requires a neural net implementation to be passed!");
				return false;
			}
			
			var output 	= [];
			var c 		= 0;
			
			var tscore	= 0;
			var tn		= 0;
			var twscore	= 0;	// Weighted score
			var twn		= 0;	// Weighted count
			
			var accuracyData = {
				regular:	[],
				weighted:	[]
			}
			
			
			// Test the data
			_.each(options.data, function(point) {
				if (point.output) {
					var response = options.neural.run(point.input);
					
					// Get the number of outputs
					var outputNumber = _.keys(point.output).length;
					
					// Compare to the known output
					var score	= 0;
					var n		= 0;
					var wscore	= 0;	// Weighted score
					var wn		= 0;	// Weighted count
					var i;
					for (i in response) {
						if (options.binaryOutput) {
							var r = Math.round(response[i]);
						} else {
							var r = response[i];
						}
						if (options.binaryOutput && options.weighted) {
							// Binary output and weighted (Example: trend up/down forecasting)
							if (r == point.output[i]) {
								score++;
								wscore += outputNumber-(i*1);
								tscore++;
								twscore += outputNumber-(i*1);
							}
							n++;
							wn += outputNumber-(i*1);
							tn++;
							twn += outputNumber-(i*1);
						} else if (options.binaryOutput && !options.weighted) {
							// Binary output and not weighted
							if (r == point.output[i]) {
								score++;
								wscore++;
								tscore++;
								twscore++;
							}
							n++;
							wn++;
							tn++;
							twn++;
						} else if (!options.binaryOutput && !options.weighted) {
							// Not a binary output and not weighted
							// Calculate the % accuracy
							var pct = Math.max(r, point.output[i])-Math.min(r, point.output[i])/point.output[i];
							score += pct;
							wscore += pct;
							tscore += pct;
							twscore += pct;
							n++;
							wn++;
							tn++;
							twn++;
						} else {
							//!options.binaryOutput && options.weighted
							// Not binary, but weighted
							var pct = Math.max(r, point.output[i])-Math.min(r, point.output[i])/point.output[i];
							score++;
							wscore += (outputNumber-(i*1))*pct;
							tscore++;
							twscore += (outputNumber-(i*1))*pct;
							n++;
							wn += outputNumber-(i*1);
							tn++;
							twn += outputNumber-(i*1);
						}
						
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
			
			
			callback({
				score:		Math.round(tscore/tn*100),
				wscore:		Math.round(twscore/twn*100),
				chart:		chart,
				output:		output
			});
		}
		
		this.mongo	= new Gamify.mongo({database: Gamify.settings.db});
		this.mongo.init(function() {
			loaded = true;
		});
		
	})();
};