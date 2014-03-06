exports.output = function(input, server, params) {
	server.set("Content-Type", "text/html");
	server.send(200, input);
	return true;
}