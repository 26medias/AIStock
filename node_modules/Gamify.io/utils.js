var _ 					= require('underscore');
var nodecrypto 			= require('crypto');
var uuid 				= require('./uuid');


function utils() {
	
}

utils.prototype.extend = function(target, source) {
	for (var key in source) {
		var original = target[key];
		var next = source[key];
		if (original && next && typeof next == "object") {
			this.extend(original, next);
		} else {
			target[key] = next;
		}
	}
	return target;
}

utils.prototype.uuid = function() {
	return uuid.v4();
}

utils.prototype.pad = function(str, size) {
	var len 	= str.length;
	var free	= size-len;
	
	if (free <= 0) {
		return str;
	}
	var tabsize	= 8;
	var ntabs	= Math.ceil(free/tabsize);
	var i;
	/*for (i=0;i<ntabs;i++) {
		str = str+"\t";
	}*/
	if (free > 0) {
		str = str+"\x1B[90m";	// grey
	}
	for (i=0;i<free;i++) {
		str = str+"-";
	}
	str = str+"\x1B[39m";	// reset
	return str;
}

utils.prototype.indexed = function(data, key) {
	var i;
	var buffer = {};
	for (i in data) {
		if (data[i][key]) {
			buffer[data[i][key]] = data[i];
		}
	}
	return buffer;
}
utils.prototype.group = function(data, keys) {
	
	var grouped = _.groupBy(data, function(item) {
		return item[keys[0]];
	});
	
	var i;
	for (i in grouped) {
		grouped[i] = _.groupBy(grouped[i], function(subitem) {
			return subitem[keys[1]];
		});
	}
	
	return grouped;
}

exports.main = new utils();
