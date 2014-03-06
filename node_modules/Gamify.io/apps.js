var _ 					= require('underscore');
var file 				= require('./file.js').main;

function apps() {
	this.file 		= new file();
}
apps.prototype.list = function(callback) {
	var files = this.file.listFiles("./routes","js", function(list) {
		var i;
		var output = {};
		for (i=0;i<list.length;i++) {
			var includepath	= list[i].substr(0,list[i].length-3);
			var	parts		= includepath.split("/");
			var urlpath		= parts[parts.length-1];
			output[urlpath]	= includepath;
		}
		callback(output);
	});
}

exports.main = apps;