// telemetry source object for the iPhone_SensorLog

const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const fs = require('fs');
var iPhone_SensorLogCreateDict = require('../oci-telemetry-iphone-client/example/iPhone_SensorLog/iPhone_SensorLogCreateDict');

//asynchronous Clean history of duplicates
// Loops through each channels history and removes duplicate points to save memory
async function asyncCleanHistoryOfDuplicates(obj) {
	await null;
	function cleanDuplicates (obj, item, index){
			var replacementArray = [];
			replacementArray.push(obj[item][0]);
			replacementArray.push(obj[item][1]);

			for(let i = 2; i < obj[item].length; i++){
				if(obj[item][i].value == replacementArray[replacementArray.length - 1].value && obj[item][i].value == replacementArray[replacementArray.length - 2 ].value){
					replacementArray[replacementArray.length - 1] = obj[item][i];
				}
				else{
					replacementArray.push(obj[item][i]);
				}
			}
			obj[item] = replacementArray;
	}
	
	return new Promise((resolve, reject) => {
		console.log("History Clean of Duplicates - iPhone_SensorLog");
		Object.keys(obj).forEach(function (item, index) {
			if(obj[item].length > 2){
				cleanDuplicates(obj, item, index);
			}
		});
		//resolve(JSON.stringify(obj));
	});
}

function iPhone_SensorLog() {

	
	// Initialize working Parameters and Object

	// read the keys from dictionary
	const localDictionary = new iPhone_SensorLogCreateDict;
	let rawDict = JSON.stringify(localDictionary);
	//let rawDict = fs.readFileSync('../oci-telemetry-iphone-client/example/iPhone_SensorLog/iPhone_SensorLogdictionary.json')
	let dict = JSON.parse(rawDict)
	//console.log(dict.measurements.map(obj => obj.key))

	this.state={};
	this.orderedKeys = [];
	(dict.measurements.map(obj => obj.key)).forEach(function (k) {
		this.orderedKeys.push(k);
		this.state[k] = 0;
	}, this);
	//console.log(this.state)
	//for (let i = 0; i < this.orderedKeys.length; i++){
	//	console.log(this.orderedKeys[i]);
	//}
	
	// History Object, holds all the history data (messages)
    this.history = {}; //history object
    this.listeners = [];
	this.data = []; // temporary data array
	this.continousLogging = false; //whether continous logging is used
	this.FileTimestamp = '';

	this.saveDuplicateYValues = false;
	this.clearHistoryOnNewSession = true;
	this.currentSessionUID = null;
	this.clearHistoryOnFrameIDRestart = true;
	this.clearHistoryOnSessionTimeRestart = true;
	this.frameIDRestartTrigger = false;
	this.sessionTimeRestartTrigger = false;
	this.currentFrameID = null;
	this.currentSessionTime = null;

	// keys initialized in the history object
	Object.keys(this.state).forEach(function (k) {
        this.history[k] = [];
	}, this);

	// to notify telemetry server interval based (STFE) uncomment here
    //setInterval(function () {
    //    this.generateIntervalTelemetry();
    //}.bind(this), 100); //z.B. 100ms according to SFTE


    this.messageCount = 0 //for keeping an idea on history sizes

	function storeDatum(key, newValue, message, history, keepDuplicates = false, showLogs = false) {
		if(keepDuplicates || history[key].length < 2){
			if(showLogs) console.log("    Less than 2", message);
			try{ 
				history[key].push(message);
			} catch (e) {
				console.log(e)
			}
		}
		else{
			// Replace last item in array if it is a duplicate Y value, checks last two
			try{ 
				if(history[key][history[key].length - 1].value == newValue && history[key][history[key].length - 2].value == newValue){
					if(showLogs) console.log("    Duplicate Y data, replacing...");
					if(showLogs) console.log("    ", history[key][history[key].length - 1]);
					if(showLogs) console.log("    ", message);
					history[key][history[key].length - 1] = message;
				}
				else{
					if(showLogs) console.log("    Not duplicate", message);
					history[key].push(message);
				}
			} catch (e) {
				console.log(e)
			}
		}
		if(showLogs) console.log("Finish---", key);
	}

	// What to do when a message from the UDP Port arrives
    server.on('message', (msg, rinfo) => {
		//parse the data (expected: key, data, timestamp in seconds)
		//this.data = `${msg}`.split(',');
		
		try{
			this.data = JSON.parse(`${msg}`);
		}
		catch(err){
			console.log("Rouge message, packet iPhoneSensorLog:");
			console.log(err);
			return;
		}
		//console.log(this.data.length);
		if(this.data.length != 3){
			console.log("Rouge message, packet iPhoneSensorLog:");
			return;
		}
		// Packet iPhoneSensorLog is expected to be 82
		//console.log("Packet iPhoneSensorLog length", this.data[1].length);
		if(this.data[1].length != 82){
			console.log("Rouge message length, packet iPhoneSensorLog:");
			return;
		}
		
		//console.log(this.data);


		this.messageCount = this.messageCount + 1;
		if(this.messageCount % 1000 == 0){
			console.log("    Packet iPhoneSensorLog messages received: ", this.messageCount);
			// usages in megabytes(MB)
    		//console.log("Memory usage by rss:", process.memoryUsage.rss()/1000000, "MB");
			//var tidyObj = asyncCleanHistoryOfDuplicates(this.history);
		}

		// Check server message
		//console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`)
        //console.log(`server got: ${this.data[8]} from ${rinfo.address}:${rinfo.port}`)
		
		// Now parsing a large data set, expects the data in order from the iPhoneSensorLog documentation
		// (packet_iPhoneSensorLog, data, timestamp)
		//console.log(this.data[0]);
		if(this.data[0] == "packet_iPhoneSensorLog"){
			
			// Update state data

			// Clear history options
			//this.clearHistory(sessionUID, sessionTime, frameID);

			//console.log(this.data[1]);
			//console.log(this.orderedKeys[0]);

			// Time Stamp
			this.state['Time.stamp'] = Math.round(this.data[2]*1000); //convert python timestamp[s] to JS timestamp [ms]
			//console.log(this.state['Time.stamp']);

			// iPhone Data from SensorLog
			for (let i = 0; i < 82; i++){
				// Update current state
				var key = this.orderedKeys[i];
				//console.log("Start---",key);
				var newValue = this.data[1][i];
				this.state[key] = newValue;

				// Build and send message
				var message = { timestamp: this.state['Time.stamp'], value: newValue, id: key};
				//console.log(message);
				this.notify(message);

				// Store in history
				storeDatum(key, newValue, message, this.history, this.saveDuplicateYValues, false);
			}
		}
	});
	
	server.on('error', (err) => {
		console.log(`iPhone_SensorLog UDP server error:\n${err.stack}`);
		try{
			console.log('Try to reconnect...')
			server.bind(50022);
		} catch(e) {
			console.log('Reconnect Failed...')
			console.log(e)
			server.close()
		}
		
	});

	// port specified in the associated python script
	server.bind(50022);

    console.log("--iPhone_SensorLog initialized--");
};


// to update every time new data comes in
iPhone_SensorLog.prototype.generateRealtimeTelemetry = function () {

	// Real Timestamp
	var timestamp = this.state['Time.stamp'];
	// Artificial timestamp
	//var timestamp= Date.now();

	// build message
	var message = { timestamp: timestamp, value: this.state[this.data[0]], id: this.data[0]};
	// notify realtimeserver
	this.notify(message);
	//console.log(message);

}


// to update interval based (STFE)
iPhone_SensorLog.prototype.generateIntervalTelemetry = function () {

    Object.keys(this.state).forEach(function (id) {

        // Real Timestamp
		var timestamp = this.state['Time.stamp'];
		// Artificial timestamp
        //var timestamp= Date.now();

		// built message
		var message = { timestamp: timestamp, value: this.state[id], id: id};
		// notify realtimeserver
        this.notify(message);
		
	}, this);
	//console.log(state);
};


// notifiy function, called in generate Telemetry, notifies listeners
iPhone_SensorLog.prototype.notify = function (point) {
    this.listeners.forEach(function (l) {
        l(point);
    });
};


// manages listeners for realtime telemetry
iPhone_SensorLog.prototype.listen = function (listener) {
    this.listeners.push(listener);
    return function () {
        this.listeners = this.listeners.filter(function (l) {
            return l !== listener;
        });
    }.bind(this);
};

// Creating a File Timestamp 
iPhone_SensorLog.prototype.SetFileTimestamp = function () {

	//zero needed for right time and date format when copy-pasting in OpenMCT
	addZero = function(dateNumber) {
		if (dateNumber.toString().length == 1){
			dateNumber = '0'+dateNumber.toString()
		}
		return dateNumber
	}
	//Generate timestamp for the File
	var date = new Date();
	var year = date.getFullYear();
	var month = addZero(date.getMonth() + 1);      // "+ 1" because the 1st month is 0
	var day = addZero(date.getDate());
	var hour = addZero(date.getHours());
	var minutes = addZero(date.getMinutes());
	var seconds = addZero(date.getSeconds());
	this.FileTimestamp = year+ '-'+ month+ '-'+ day+ ' '+ hour+ '-'+ minutes+ '-'+ seconds;

};

// Clears the object history arrays
iPhone_SensorLog.prototype.clearHistoryObject = function (){
	console.log("Clear History Object - F1_T00_Motion");
	Object.keys(this.history).forEach(function (k) {
		this.history[k] = [];
	}, this);
}

// Does some checks and clears history arrays if criteria met
iPhone_SensorLog.prototype.clearHistory = function (sessionUID, sessionTime, frameID){
	// Clear on new session
	if(this.clearHistoryOnNewSession){
		// Initialize
		if(this.currentSessionUID == null){
			this.currentSessionUID = sessionUID;
		}
		if(this.currentSessionUID != sessionUID){
			//console.log("Clear history, new session UID:", sessionUID);
			this.clearHistoryObject();
			this.currentSessionUID = sessionUID;
			this.messageCount = 0;
			this.frameIDRestartTrigger = false;
			this.sessionTimeRestartTrigger = false;
			return;
		}
	}
	// Clear on if frame ID restarts or session time restarts
	if(this.clearHistoryOnFrameIDRestart && this.clearHistoryOnSessionTimeRestart){
		// Initialize
		if(this.currentFrameID == null){
			this.currentFrameID = frameID;
			this.frameIDRestartTrigger = false;
		}
		if(this.currentSessionTime == null){
			this.currentSessionTime = sessionTime;
			this.sessionTimeRestartTrigger = false;
		}
		// Checks
		if(frameID < this.currentFrameID){
			this.frameIDRestartTrigger = true;
		}
		if(sessionTime < this.currentSessionTime){
			this.sessionTimeRestartTrigger = true;
		}
		// Trigger
		if(this.frameIDRestartTrigger && this.sessionTimeRestartTrigger){
			this.clearHistoryObject();
			this.frameIDRestartTrigger = false;
			this.sessionTimeRestartTrigger = false;
			this.messageCount = 0;
		}

		this.currentFrameID = frameID;
		this.currentSessionTime = sessionTime;
	}
};

//asynchronous Strigify an object/a variable to JSON format
iPhone_SensorLog.prototype.asyncStringyify = function (obj) {
	return new Promise((resolve, reject) => {
	  resolve(JSON.stringify(obj));
	});
  }



// what to do on incoming command
iPhone_SensorLog.prototype.command = function (command) {

	// Logs the history variable (this.history) once
	if(command === ':saveHistory'){
		
		
		this.SetFileTimestamp()

		//Using Promises for not interrupting the main loop
		function asyncSaveHistory(str) {
			return new Promise((resolve, reject) => {
			  resolve(JSON.stringify(str));
			});
		  }

		this.asyncStringyify(this.history).then(function(write) {//write is the value of the resolved promise in asyncStringify
			fs.writeFile(__dirname + '/saved_logs/iPhone_SensorLog_'+this.FileTimestamp+'_History.json', write, (err) => {
				if (err) {
					console.log(err);
				} else {
				console.log('History Saved!')
				}
			}) 
		}.bind(this));
	
	};


	// Logs the history variable (this.history) every 10s
	// because of the structure of this.history, with the current logic the file has to be rewritten on every save
	// due to this, a lot of performance is needed, especially on long recordings >20min with a lot of data (40 telemetry points @10Hz)
	// not recommended, instead save the history at the end of the test with the "saveHistory" command on log only messages continously, so secure the data

	// if(command === ':startcontinousHistoryLog'){
		
	// 	this.SetFileTimestamp()

	// 	Using Promises for not interrupting the main loop
	// 	function asyncLogging(src) {
	// 		return new Promise((resolve, reject) => {
				
	// 		  resolve(JSON.stringify(src));
	// 		});
	// 	  }
		
	
	// 	save log in specified interval
	// 	logging = setInterval(function () {
	// 		asyncLogging(this.history).then(function(write) {//write is the value of the resolved promise in asyncStringify
	// 			fs.writeFile(__dirname + '/saved_logs/iPhone_SensorLog_'+this.FileTimestam+'.json', write, (err) => {
	// 				if (err) {
	// 					throw err;
	// 				}
	// 				console.log(this.history);
	// 				console.log('Logging!')
	// 			}) 
	// 		}.bind(this));
	// 	}.bind(this), 10000); 
	
			
	// };


	// if(command === ':endContinousHistoryLog'){
	// 	clearInterval(logging);
	// 	console.log('Logging stopped!')	
	// };


	// for continous logging use this method, saved file can not be used in OpenMCT as is, but all data is stored more efficiently 
	if(command === ':startLog'){

		this.SetFileTimestamp()

		this.continousLogging = true;
		console.log('Logging started!')	
	};

	if(command === ':endLog'){
		this.continousLogging = false;
		console.log('Logging stopped!')	
	};


	// Example implementation of sending a command
	if(command === ':exampleCommandtoPlane'){
		// sending to the specified udp port on the address 'loacalhost'
		server.send(command,50023, 'localhost')
		console.log('Command Sent via UDP Port!')	
	};

	
};


module.exports = function () {
    return new iPhone_SensorLog()
};
