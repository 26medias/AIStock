exports.output = function(input, server, params) {
	server.set("Content-Type", "application/json");
	server.send(200, JSON.stringify(input, null, 4));
	return true;
}