var _ 					= require('underscore');
var walk    			= require('walk');
var fs 					= require('fs');


function file() {
	
}

// List file by extention in any subdirectory
file.prototype.listFiles = function(dir, ext, callback, options) {
	
	options = _.extend({
		followLinks: 	false
	},options);
	
	var files   = [];
	
	// Walker options
	var walker  = walk.walk(dir, options);
	
	walker.on('file', function(root, stat, next) {
		var parts = stat.name.split(".");
		if (parts[parts.length-1] == ext) {
			files.push(root + '/' + stat.name);
		}
		next();
	});
	
	walker.on('end', function() {
		callback(files);
	});
}

// File to Object
file.prototype.toObject = function(file, callback) {
	fs.readFile(file, 'utf8', function (err, data) {
		if (err) {
			callback(false);
		} else {
			callback(JSON.parse(data));
		}
	});
}
file.prototype.read = function(file, callback) {
	fs.readFile(file, 'utf8', function (err, data) {
		if (err) {
			callback(false);
		} else {
			callback(data);
		}
	});
}

exports.main = new file();