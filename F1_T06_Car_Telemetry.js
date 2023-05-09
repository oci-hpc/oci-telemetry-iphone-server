// telemetry source object for the F1_T06_Car_Telemetry

const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const fs = require('fs');
var process = require('process');
var F1_T06_Car_TelemetryCreateDict = require('../openmct/example/F1_T06_Car_Telemetry/F1_T06_Car_TelemetryCreateDict');

//asynchronous Clean history of duplicates
// Loops through each channels history and removes duplicate points to save memory
async function asyncCleanHistoryOfDuplicates(obj) {
	await null;
	function cleanDuplicates (obj, item, index){
		//console.log(item);
		//if (item == "clutch"){
			//console.log(item);
			//console.log("Before:", obj[item].length);
			var replacementArray = [];
			replacementArray.push(obj[item][0]);
			replacementArray.push(obj[item][1]);

			// Just check the last incriment of data
			//incriment = 600;
			//if(obj[item].length < incriment){
			//	incriment = obj[item].length;
			//}

			for(let i = 2; i < obj[item].length; i++){
				//console.log(obj[item][i].value, replacementArray[replacementArray.length - 1].value, replacementArray[replacementArray.length - 2 ].value)
				if(obj[item][i].value == replacementArray[replacementArray.length - 1].value && obj[item][i].value == replacementArray[replacementArray.length - 2 ].value){
					//console.log("Was:", replacementArray[replacementArray.length - 1], "Changing to:", obj[item][i]);
					//console.log("Replace", (obj[item][i].value == replacementArray[replacementArray.length - 1].value && obj[item][i].value == replacementArray[replacementArray.length - 2 ].value));
					replacementArray[replacementArray.length - 1] = obj[item][i];
					//console.log("Is now:",  replacementArray[replacementArray.length - 1]);
				}
				else{
					replacementArray.push(obj[item][i]);
				}
			}
			obj[item] = replacementArray;
			//console.log("After:", obj[item].length);
		//}
	}
	
	//console.log("Start duplicate cleanup");
	return new Promise((resolve, reject) => {
		console.log("History Clean of Duplicates - T06 Car Telemetry");
		//console.log(Object.keys(obj));
		Object.keys(obj).forEach(function (item, index) {
			if(obj[item].length > 2){
				cleanDuplicates(obj, item, index);
				//console.log("Duplicate cleanup", item);
			}
		});
		//resolve(JSON.stringify(obj));
		//console.log("End duplicate cleanup");
	});
}




function F1_T06_Car_Telemetry() {

	
	// Initialize working Parameters and Object

	// read the keys from dictionary
	const localDictionary = new F1_T06_Car_TelemetryCreateDict;
	let rawDict = JSON.stringify(localDictionary);
	//let rawDict = fs.readFileSync('../openmct/example/F1_T06_Car_Telemetry/F1_T06_Car_Telemetrydictionary.json')
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
		
//	// to notify telemetry server interval based (STFE) uncomment here
//    setInterval(function () {
//        this.generateIntervalTelemetry();
//    }.bind(this), 100); //z.B. 100ms according to SFTE

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
		if(showLogs) console.log("Finish---",key);
	}

	function clearHistory(history){
		console.log("Clear History");
		Object.keys(history).forEach(function (k) {
			history[k] = [];
		});
		this.messageCount = 0;
	}

	//Do this when a message from the UDP Port arrives
    server.on('message', (msg, rinfo) => {
		//parse the data (expected: key, data, timestamp in seconds)
		//this.data = `${msg}`.split(',');
		try{
			this.data = JSON.parse(`${msg}`);
		}
		catch(err){
			console.log("Rouge message, packet 06:");
			console.log(err);
			return;
		}
		
		//console.log(this.data.length);
		if(this.data.length != 4){
			console.log("Rouge message, packet 06:");
			return;
		}
		// Packet 06 is expected to be 685
		//console.log("Packet 6 length", this.data[2].length);
		if(this.data[2].length != 685){
			console.log("Rouge message length, packet 06:");
			return;
		}
		
		
		this.messageCount = this.messageCount + 1;
		if(this.messageCount % 600 == 0){
			console.log("    Packet 06 messages received: ", this.messageCount);
			// usages in megabytes(MB)
    		console.log("Memory usage by rss:", process.memoryUsage.rss()/1000000, "MB");
			//this.asyncCleanHistoryOfDuplicates(this.history);
			//console.log("This is supposed to be async");
			//var historyCleanPromise = asyncCleanHistoryOfDuplicates(this.history);
			//console.log(historyCleanPromise);
			//console.log("This is supposed to be async");

		}



		// Check server message
		//console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`)
        //console.log(`server got: ${this.data[8]} from ${rinfo.address}:${rinfo.port}`)


		// Now parsing a large data set, expects the data in order from the game documentation
		// (packet_00, header, data, timestamp)
		//console.log(this.data[0]);
		if(this.data[0] == "packet_06"){
			
			// Update state data
			header = this.data[1];
			slugSize = 31;
			extraSlugSize = 3;
			player1Index = header[8];
			let sessionUID = header[5];
			let sessionTime = header[6];
			let frameID = header[7];

			// Clear history options
			this.clearHistory(sessionUID, sessionTime, frameID);


			// Time Stamp
			this.state['Time.stamp'] = Math.round(this.data[3]*1000); //convert python timestamp[s] to JS timestamp [ms]
			//console.log(this.state['Time.stamp']);

			// Player 1 data first
			for (let i = 0; i < slugSize; i++){
				// Update current state
				var key = this.orderedKeys[i];
				//console.log("Start---",key);
				var newValue = this.data[2][player1Index * slugSize + i];
				this.state[key] = newValue;

				// Build and send message
				var message = { timestamp: this.state['Time.stamp'], value: newValue, id: key};
				this.notify(message);

				// Store in history
				storeDatum(key, newValue, message, this.history, this.saveDuplicateYValues, false);
			}
			// Other car data
			for (let j = 0; j < 22; j++){
				for (let k = 0; k < slugSize; k++){
					// Update current state
					var key = this.orderedKeys[slugSize + (j * slugSize) + k];
					//console.log("Start---", key);
					var newValue = this.data[2][j * slugSize + k];
					this.state[key] = newValue;

					// Build and send message
					var message = { timestamp: this.state['Time.stamp'], value: newValue, id: key};
					this.notify(message);
					
					// Store in history
					storeDatum(key, newValue, message, this.history, this.saveDuplicateYValues, false);
				}
			}
			// Extra Data
			for (let l = 0; l < extraSlugSize; l++){
				// 23 X 31 + 1 = 713, 22 X 31 + 1 = 682
				// Update current state
				var key = this.orderedKeys[713 + l];
				//console.log("Start---", key);
				var newValue = this.data[2][682 + l];
				this.state[key] = newValue;

				// Build and send message
				var message = { timestamp: this.state['Time.stamp'], value: newValue, id: key};
				this.notify(message);

				// Store in history
				storeDatum(key, newValue, message, this.history, this.saveDuplicateYValues, false);
			}
		}
	});
	
	server.on('error', (err) => {
		console.log(`F1_T06_Car_Telemetry UDP server error:\n${err.stack}`);
		try{
			console.log('Try to reconnect...')
			server.bind(56022);
		} catch(e) {
			console.log('Reconnect Failed...')
			console.log(e)
			server.close()
		}
		
	});

	// port specified in the associated python script
	server.bind(56022);

    console.log("--F1_T06_Car_Telemetry initialized--");
};


// to update every time new data comes in
F1_T06_Car_Telemetry.prototype.generateRealtimeTelemetry = function () {

	// Real Timestamp
	var timestamp = this.state['Time.stamp'];
	// Artificial timestamp
	//var timestamp= Date.now();

	// built message
	var message = { timestamp: timestamp, value: this.state[this.data[0]], id: this.data[0]};
	// notify realtimeserver
	this.notify(message);
	//console.log(message);

}


// to update interval based (STFE)
F1_T06_Car_Telemetry.prototype.generateIntervalTelemetry = function () {

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
F1_T06_Car_Telemetry.prototype.notify = function (point) {
    this.listeners.forEach(function (l) {
        l(point);
    });
};


// manages listeners for realtime telemetry
F1_T06_Car_Telemetry.prototype.listen = function (listener) {
    this.listeners.push(listener);
    return function () {
        this.listeners = this.listeners.filter(function (l) {
            return l !== listener;
        });
    }.bind(this);
};

// Creating a File Timestamp 
F1_T06_Car_Telemetry.prototype.SetFileTimestamp = function () {

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
F1_T06_Car_Telemetry.prototype.clearHistoryObject = function (){
	console.log("Clear History Object - F1_T06_Car_Telemetry");
	Object.keys(this.history).forEach(function (k) {
		this.history[k] = [];
	}, this);
}

// Does some checks and clears history arrays if criteria met
F1_T06_Car_Telemetry.prototype.clearHistory = function (sessionUID, sessionTime, frameID){
	// Clear on new session
	if(this.clearHistoryOnNewSession){
		// Initialize
		if(this.currentSessionUID == null){
			this.currentSessionUID = sessionUID;
		}
		if(this.currentSessionUID != sessionUID){
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
F1_T06_Car_Telemetry.prototype.asyncStringyify = function (obj) {
	return new Promise((resolve, reject) => {
	  resolve(JSON.stringify(obj));
	});
}




// what to do on incoming command
F1_T06_Car_Telemetry.prototype.command = function (command) {

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
			fs.writeFile(__dirname + '/saved_logs/F1_T06_Car_Telemetry_'+this.FileTimestamp+'_History.json', write, (err) => {
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
	// 			fs.writeFile(__dirname + '/saved_logs/F1_T06_Car_Telemetry_'+this.FileTimestam+'.json', write, (err) => {
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
		// Running locally your can use localhost or 0.0.0.0, on cloud use 0.0.0.0
		//server.send(command,56023, 'localhost')
		server.send(command,56023, '0.0.0.0')
		console.log('Command Sent via UDP Port!')	
	};

	
};


module.exports = function () {
    return new F1_T06_Car_Telemetry()
};
