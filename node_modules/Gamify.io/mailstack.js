var _ 					= require('underscore');
var nodecrypto 			= require('crypto');
var uuid 				= require('./uuid');



function Mailstack(db, Gamify, callback) {
	
	var mongo 				= require('./mongo').main(Gamify);
	
	// Gamify instance, not reference
	this.Gamify = Gamify;
	
	// Init a connection
	this.mongo	= new mongo({database:db});
	this.mongo.init(function() {
		callback();
	});
}

Mailstack.prototype.send = function(options, callback) {
	var data = _.extend({
		time:		new Date().getTime(),
		uuid:		uuid.v4(),
		priority:	5,
		params:		{}
	}, options);
	
	console.log("\033[35m [>send]:\033[37m",data);
	
	var sendnow = function() {
		this.mongo.insert({
			collection:	"mailstack",
			data:		data
		}, function() {});
	}
	
	if (!data.user) {
		this.Gamify.api.execute("user","find", {query:{uid:data.uid}}, function(response) {
			if (response.length > 0) {
				var user = response[0];
				data.user = user;
				sendnow();
			} else {
				callback({error: "Undefined user", options: options});
			}
		})
	} else {
		sendnow();
	}
	
	
}

exports.main = Mailstack;
