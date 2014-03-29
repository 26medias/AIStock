var _ 					= require('underscore');
var walk    			= require('walk');
var fs 					= require('fs');
var path 				= require('path');
var compressor			= require('node-minify');
var twig				= require('twig').twig;
var dependency			= new (require('./dependency').main)();
var stack				= require('./stack').main;
var file				= require('./file').main;
var ncp 				= require('ncp').ncp;
var wrench 				= require('wrench');

var builder = function() {
	var scope 	= this;
	this.file	= new file();
	
	this.base 	= "..";
	
	this.file.toObject(this.base+"/build.json", function(buildProfile) {
		scope.buildProfile = buildProfile;
		
		dependency.dir = scope.base+"/"+buildProfile.src+"/bower_components"
		
		// Map the libraries
		dependency.map(function() {
			// Verify there are no missing dependencies
			dependency.verify();
			//console.log("Test",dependency.getFor(["FormJS"]));
			// Init the build
			scope.init();
		})
	});
		
}
builder.prototype.init = function() {
	var scope 	= this;
	
	// Delete the output directory
	scope.file.removeDir(scope.buildProfile.output, function() {
		// Create the output directory
		scope.file.createPath(scope.buildProfile.output, function() {
			scope.loadTemplates(function() {
				// List the pages
				scope.file.listDirectories(scope.base+"/"+scope.buildProfile.src+"/"+scope.buildProfile.pages, function(directories) {
					console.log("directories",directories);
					
					var buildStack = new stack();
					
					_.each(directories, function(dir) {
						buildStack.add(function(p, cb) {
							scope.buildPage(p.dir, cb);
						}, {dir:dir});
					});
					
					buildStack.process(function() {
						console.log("Pages built.");
						
						// Copy the libs
						ncp(scope.base+"/"+scope.buildProfile.src+"/bower_components", scope.base+"/"+scope.buildProfile.output+"/public", function() {
							console.log("Libs copied from ", scope.base+"/"+scope.buildProfile.src+"/bower_components", " to ", scope.base+"/"+scope.buildProfile.output);
						});
						
						// Copy the images
						ncp(scope.base+"/"+scope.buildProfile.src+"/images", scope.base+"/"+scope.buildProfile.output+"/images", function() {
							console.log("Libs copied from ", scope.base+"/"+scope.buildProfile.src+"/images", " to ", scope.base+"/"+scope.buildProfile.output);
						});
					});
				});
			});
		});
	});
}
builder.prototype.loadTemplates = function(callback) {
	var scope		= this;
	console.log("Loading templates...");
	
	this.templates	= {};
	
	this.file.listFiles(this.base+"/"+this.buildProfile.src+"/"+this.buildProfile.templates, "html", function(files) {
		
		var readStack = new stack();
		
		_.each(files, function(file) {
			
			readStack.add(function(p, cb) {
				console.log("Pre-compiling "+p.file+" ...");
				scope.file.read(p.file, function(content) {
					scope.templates[path.basename(p.file)] = twig({
						data: 	content
					});
					cb();
				});
			}, {file:file});
		});
		
		readStack.process(function() {
			console.log("Templates loaded.");
			callback();
		});
	});
}
builder.prototype.buildPage = function(page, callback) {
	var scope 	= this;
	console.log("Building '"+page+"'...");
	this.file.toObject(this.base+"/"+this.buildProfile.src+"/"+this.buildProfile.pages+"/"+page+"/page.json", function(pageConf) {
		
		var fileStack = new stack();
		var file;
		for (file in pageConf.files) {
			fileStack.add(function(p, cb) {
				console.log("Reading ",scope.base+"/"+scope.buildProfile.src+"/"+scope.buildProfile.pages+"/"+page+"/"+p.file);
				scope.file.read(scope.base+"/"+scope.buildProfile.src+"/"+scope.buildProfile.pages+"/"+page+"/"+p.file, function(content) {
					
					// Get the subdocument's source (parsed with Twig)
					/*var pageData = twig({
						data: 	content
					}).render({});*/
					var pageData = content;
					
					// Add the dependencies for that specific page
					if (p.fileData.dependencies) {
						pageConf.dependencies = _.union(pageConf.dependencies, p.fileData.dependencies);
					}
					// Get the libraries
					var libs = dependency.getFor(pageConf.dependencies);
					
					// Inject into the main template and write
					var filename 	= scope.base+"/"+scope.buildProfile.output+"/"+p.fileData.filename;
					var filepath	= path.dirname(filename);
					wrench.mkdirSyncRecursive(filepath, 0777);
					var relativepath	= path.relative(path.dirname(p.fileData.filename), "./");
					if (relativepath != "") {
						relativepath += "/";
					}
					if (p.fileData.template) {
						var twigTemplate = scope.templates[p.fileData.template];
					} else {
						var twigTemplate = scope.templates[pageConf.template];
					}
					
					scope.file.write(filename, twigTemplate.render(_.extend(p.fileData,{
						page:			pageConf,
						file:			p.fileData.filename,
						relativepath:	relativepath,
						content:		pageData,
						include_js:		scope.getIncludes(libs, ".js",	relativepath),
						include_css:	scope.getIncludes(libs, ".css", relativepath),
						include_less:	scope.getIncludes(libs, ".less", relativepath)
					})), function() {
						console.log("file "+p.fileData.filename+" written.");
						cb();
					});
				});
			},{file:file, fileData:pageConf.files[file], pageConf:pageConf});
		}
		
		fileStack.process(function() {
			console.log("Page "+page+" built.");
			callback();
		});
		
	});
}
builder.prototype.getIncludes = function(files, type, relativepath) {
	var list 		= files[type];
	
	var output 		= [];
	var scope		= this;
	switch (type) {
		case ".js":
			_.each(list, function(file) {
				file = file.replace(scope.base+"/"+scope.buildProfile.src+"/bower_components", "public");
				if (file.substr(0,4) == "http") {
					output.push('<script src="'+file+'"></script>');
				} else {
					output.push('<script src="'+file+'"></script>');
				}
			});
		break;
		case ".css":
			_.each(list, function(file) {
				file = file.replace(scope.base+"/"+scope.buildProfile.src+"/bower_components", "public");
				if (file.substr(0,4) == "http") {
					output.push('<link href="'+file+'" rel="stylesheet">');
				} else {
					output.push('<link href="'+file+'" rel="stylesheet">');
				}
				
			});
		break;
		case ".less":
			_.each(list, function(file) {
				file = file.replace(scope.base+"/"+scope.buildProfile.src+"/bower_components", "public");
				if (file.substr(0,4) == "http") {
					output.push('<link rel="stylesheet/less" type="text/css" href="'+file+'" />');
				} else {
					output.push('<link rel="stylesheet/less" type="text/css" href="'+file+'" />');
				}
				
			});
		break;
	}
	return output.join('\n');
}

new builder();