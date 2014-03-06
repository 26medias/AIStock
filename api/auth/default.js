function auth() {
	
}
auth.prototype.init = function(Gamify, callback){
	var scope = this;
	
	this.Gamify = Gamify;
	
	// Return the methods
	var methods = {
		
		// User's access token
		authtoken:	function(params, callback) {
			// Are we using a system authtoken?
			if (params.authtoken == Gamify.settings.systoken && params.uid) {
				callback(params.uid);
			} else if (params.__auth && params.__authcheck == Gamify.settings.systoken) {
				callback(params.__auth);
			} else {
				scope.mongo.count({
					collection:	'authtokens',
					query:		{
						token:		params.authtoken,
						validity:	{
							$gt:	new Date().getTime()
						}
					}
				}, function(count) {
					if (count == 0) {
						callback(false, "Invalid AuthToken.");
					} else {
						// Get the user's data
						scope.mongo.find({
							collection:	"authtokens",
							limit:		1,
							query:		{
								token:		params.authtoken,
								validity:	{
									$gt:	new Date().getTime()
								}
							}
						}, function(response) {
							callback(response[0].uid);
							
							// In the background, set the last activity time
							scope.mongo.update({
								collection:	"users",
								query:		{
									uid:	response[0].uid	// The auth method pass that __auth data into the params
								},
								data:		{
									$set:	{
										"data.recent_activity":	new Date()
									}
								},
								options: {
									upsert: false
								}
							}, function(response) {
								// Don't care about the return, that's a background task
							});
						});
						
					}
				});
			}
		},
		
		// System access only
		sys:	function(params, callback) {
			
			console.log(">>>",params.authtoken == Gamify.settings.systoken);
			
			// Are we using a system authtoken?
			if (params.authtoken == Gamify.settings.systoken) {
				callback(params.uid);
			} else {
				callback(false, "You need a system token to call this method.");
			}
		}
	};
	
	// Init a connection
	this.mongo	= new this.Gamify.mongo({database:this.Gamify.settings.db});
	this.mongo.init(function() {
		callback(methods);
	});
}
exports.auth = auth;