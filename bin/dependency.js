var _ 					= require('underscore');
var file 				= require('./file.js').main;
var stack 				= require('./stack.js').main;
var crypto 				= require('./crypto.js').main;
var path 				= require('path');

function dependency() {
	this.file 		= new file();
	this.crypto		= new crypto();
	this.nodes		= {};
	this.resolved	= [];
	this.missing	= [];
	this.cache		= {};
	this.dir		= "./";
	
	this.public		= "public/";
}
dependency.prototype.map = function(callback) {
	var scope = this;
	
	// List the directories
	this.file.listDirectories(this.dir, function(directories) {
		console.log("directories",directories);
		
		var opStack = new stack();
		
		// For each directory
		_.each(directories, function(dir) {
			opStack.add(function(p, cb) {
				// Read the bower.json file
				scope.file.toObject(scope.dir+"/"+dir+"/bower.json", function(bowerConf) {
					if (bowerConf === false) {
						scope.file.toObject(scope.dir+"/"+dir+"/.bower.json", function(bowerConf) {
							if (bowerConf !== false) {
								scope.nodes[bowerConf.name] = {
									dir:			dir,
									data:			bowerConf,
									dependencies:	bowerConf.dependencies?_.keys(bowerConf.dependencies):[]
								};
							}
							cb();
						});
					} else {
						if (bowerConf !== false) {
							scope.nodes[bowerConf.name] = {
								dir:			dir,
								data:			bowerConf,
								dependencies:	bowerConf.dependencies?_.keys(bowerConf.dependencies):[]
							};
						}
						cb();
					}
				});
			}, {dir:dir});
		});
		
		opStack.process(function() {
			//console.log("Bower libs mapped: ",JSON.stringify(scope.nodes,null,4));
			callback();
		});
	});
	
}
dependency.prototype.verify = function() {
	var scope 	= this;
	var lib;
	var i;
	for (lib in this.nodes) {
		this.resolve(lib);
	}
	
	if (this.missing.length > 0) {
		this.missing = _.uniq(this.missing);
		console.log("You have missing client-side dependencies:\n",this.missing);
	}
	// reset
	this.resolved	= [];
}
dependency.prototype.getFor = function(libs) {
	
	// Sort
	var sorted	= libs.sort(function (a, b) {
		if (a.toLowerCase() > b.toLowerCase()) {
			return 1;
		} else if (a.toLowerCase() < b.toLowerCase()) {
			return -1;
		} else {
			return 0;
		}
	});
	
	// get MD ID (cached index)
	var md5id	= this.crypto.md5(_.map(sorted, function(item){return item.toLowerCase()}).join("|"));
	if (this.cache[md5id]) {
		return this.cache[md5id];
	}
	
	// resolve dependecies
	var resolved = this.resolveList(libs);
	var includes = this.getIncludeData(
		resolved
	);
	
	this.cache[md5id] = includes;
	
	return includes;
}
dependency.prototype.resolveList = function(libs) {
	var i;
	var includes = [];
	for (i=0;i<libs.length;i++) {
		this.resolve(libs[i],includes);
	}
	
	// reset
	this.resolved	= [];
	
	return includes;
}
dependency.prototype.resolve = function(lib, container) {
	//console.log("resolving ",lib);
	var scope 	= this;
	
	if (!this.nodes[lib]) {
		this.missing.push(lib);
		console.log("MISSING LIB: ",lib);
		return false;
	}
	var node	= this.nodes[lib];
	var i;
	for (i=0;i<node.dependencies.length;i++) {
		if (_.indexOf(this.resolved,node.dependencies[i]) === -1) {
			this.resolve(node.dependencies[i],container);
		}
	}
	if (!_.contains(this.resolved, lib)) {
		this.resolved.push(lib);
		if (container) {
			container.push(lib);
		}
	}
	
}
dependency.prototype.getIncludeData = function(libs) {
	var i;
	var j;
	var output = {};
	for (i=0;i<libs.length;i++) {
		var node	= this.nodes[libs[i]];
		var libData = node.data;
		var dir		= node.dir;
		if (_.isArray(libData.main)) {
			for (j=0;j<libData.main.length;j++) {
				var ext = path.extname(libData.main[j]);
				if (!output[ext]) {
					output[ext] = [];
				}
				// is it local or remote?
				if (libData.main[j].substr(0,4) == "http") {
					output[ext].push(libData.main[j]);
				} else {
					output[ext].push(this.dir+"/"+dir+"/"+libData.main[j]);
				}
			}
		} else {
			var ext = path.extname(libData.main);
			if (!output[ext]) {
				output[ext] = [];
			}
			// is it local or remote?
			if (libData.main.substr(0,4) == "http") {
				output[ext].push(libData.main);
			} else {
				output[ext].push(this.dir+"/"+dir+"/"+libData.main);
			}
		}
		
	}
	
	return output;
}

exports.main = dependency;