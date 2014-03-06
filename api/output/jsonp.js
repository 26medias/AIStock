exports.output = function(input, server, params) {
	server.set("Content-Type", "application/json");
	server.send(200, params.callback+"("+JSON.stringify(input)+");");
	return true;
}