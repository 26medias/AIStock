var _cluster		= require('cluster');
var _os				= require('os');
var _ 				= require('underscore');
var options = _.extend({
	timeout:	5000,		// if the process doesn't respond after this time, it is killed,
	online:		false,
	threads:	64
},processArgs());
options.thread			= Math.min(options.threads, _os.cpus().length);

console.log("Options",options);

var main;
if (options.online) {
	main			= '/home/gitbuffer/AIStock/process.js';
} else {
	main			= './process.js';
}

var i;
var workers			= {};
_cluster.setupMaster({
    exec:	main
});

for (var i = 0; i < options.thread; i++) {
    createWorker();
}

function processArgs() {
	var i;
	var args 	= process.argv.slice(2);
	var output 	= {};
	for (i=0;i<args.length;i++) {
		var l1	= args[i].substr(0,1);
		if (l1 == "-") {
			if (args[i+1] == "true") {
				args[i+1] = true;
			}
			if (args[i+1] == "false") {
				args[i+1] = false;
			}
			if (!isNaN(args[i+1]*1)) {
				args[i+1] = args[i+1]*1;
			}
			output[args[i].substr(1)] = args[i+1];
			i++;
		}
	}
	return output;
};

if (_cluster.isMaster) {
	if (options.timeout > 0) {
		setInterval(function() {
			var time = new Date().getTime();
			for (pid in workers) {
				if (workers[pid] && workers[pid].lastCheck + 5000 < time) {
					console.log("TIMEOUT: ", pid, "Data: ", workers[pid].data);
					workers[pid].worker.process.kill();
					delete workers[pid];
					createWorker();
				}
			}
		}, options.timeout);
	}
}


var processTime 	= {};
function createWorker() {
	var worker 	= _cluster.fork();
	console.log("New worker: ",worker.process.pid);
	workers[worker.process.pid] = {
		worker:		worker,
		lastCheck:	new Date().getTime()-1000	// allow boot time
	};
	worker.on('message', function(data) {
		// register the time
		var curTime = new Date().getTime();
		if (workers[worker.process.pid] && workers[worker.process.pid].lastCheck) {
			workers[worker.process.pid].data = data;
			workers[worker.process.pid].lastCheck = curTime;
		}
		
	});
	
};