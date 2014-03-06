exports.output = function(input, server, params) {
	server.set("Content-Type", "application/json");
	server.send(200, new Buffer(JSON.stringify(input)).toString('base64'));
	return true;
}