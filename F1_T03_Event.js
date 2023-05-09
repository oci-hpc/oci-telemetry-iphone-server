// telemetry source object for the F1_T03_Event

const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const fs = require('fs');
var F1_T03_EventCreateDict = require('../oci-telemetry-esports-F122-client/example/F1_T03_Event/F1_T03_EventCreateDict');

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
		console.log("History Clean of Duplicates - T03 Event");
		Object.keys(obj).forEach(function (item, index) {
			if(obj[item].length > 2){
				cleanDuplicates(obj, item, index);
			}
		});
		//resolve(JSON.stringify(obj));
	});
}

function F1_T03_Event() {

	
	// Initialize working Parameters and Object

	// read the keys from dictionary
	const localDictionary = new F1_T03_EventCreateDict;
	//console.log(localDictionary);
	let rawDict = JSON.stringify(localDictionary);
	//let rawDict = fs.readFileSync('../oci-telemetry-esports-F122-client/example/F1_T03_Event/F1_T03_Eventdictionary.json')
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
	this.data = []; // temporar data array
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
		if(showLogs) console.log("Finish---",key);
	}

	function clearHistory(history){
		console.log("Clear History");
		Object.keys(history).forEach(function (k) {
			history[k] = [];
		});
		this.messageCount = 0;
	}

	//what to do, when a message from the UDP Port arrives
    server.on('message', (msg, rinfo) => {
		//parse the data (expected: key, data, timestamp in seconds)
		//this.data = `${msg}`.split(',');
		try{
			this.data = JSON.parse(`${msg}`);
		}
		catch(err){
			console.log("Rouge message, packet 03:");
			console.log(err);
			return;
		}
		
		// Check server message
		//console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`)
        //console.log(`server got: ${this.data[8]} from ${rinfo.address}:${rinfo.port}`)
		
		//console.log(this.data.length);
		if(this.data.length != 4){
			console.log("Rouge message, packet 03:");
			return;
		}
		// Packet 03 is expected to be at least 0 so...
		//console.log("Packet 3 length", this.data[2].length);
		//if(this.data[2].length <= 0){
		//	console.log("Rouge message length, packet 03:", this.data[2].length);
		//	return;
		//}
		
		this.messageCount = this.messageCount + 1;
		if(this.messageCount % 100 == 0){
			console.log("    Packet 03 messages received: ", this.messageCount);
			// usages in megabytes(MB)
    		//console.log("Memory usage by rss:", process.memoryUsage.rss()/1000000, "MB");
			//this.asyncCleanHistoryOfDuplicates(this.history);
			//var tidyObj = asyncCleanHistoryOfDuplicates(this.history);
		}

		// Now parsing a large data set, expects the data in order from the game documentation
		// (packet_00, header, data, timestamp)
		//console.log(this.data[0]);
		if(this.data[0] == "packet_03"){
			
			// Update state data
			header = this.data[1];
			player1Index = header[8];
			let sessionUID = header[5];
			let sessionTime = header[6];
			let frameID = header[7];

			// Clear history options
			this.clearHistory(sessionUID, sessionTime, frameID);


			// Time Stamp
			this.state['Time.stamp'] = Math.round(this.data[3]*1000); //convert python timestamp[s] to JS timestamp [ms]
			//console.log(this.state['Time.stamp']);

			// Event
			if (this.data[2][0] == 'BUTN'){
				// Update current state
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;
				
				var key2 = this.orderedKeys[24];
				var newValue2 = this.data[2][1];
				this.state[key2] = newValue2;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				this.notify(message1);

				var message2 = { timestamp: this.state['Time.stamp'], value: newValue2, id: key2};
				this.notify(message2);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
				storeDatum(key2, newValue2, message2, this.history, this.saveDuplicateYValues, false);
				
			}
			else if(this.data[2][0] == 'SSTA'){
				// Update current state
				var key = this.orderedKeys[0];
				var newValue = this.data[2][0];
				this.state[key] = newValue;

				// Build and send messages
				var message = { timestamp: this.state['Time.stamp'], value: newValue, id: key};
				this.notify(message);

				// Store in history
				storeDatum(key, newValue, message, this.history, this.saveDuplicateYValues, false);
			}

			else if(this.data[2][0] == 'SEND'){
				// Update current state
				var key = this.orderedKeys[0];
				var newValue = this.data[2][0];
				this.state[key] = newValue;

				// Build and send messages
				var message = { timestamp: this.state['Time.stamp'], value: newValue, id: key};
				this.notify(message);

				// Store in history
				storeDatum(key, newValue, message, this.history, this.saveDuplicateYValues, false);
			}

			else if(this.data[2][0] == 'FTLP'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;
				// Vehicle Index
				var key2 = this.orderedKeys[1];
				var newValue2 = this.data[2][1];
				this.state[key2] = newValue2;
				// Lap time in seconds
				var key3 = this.orderedKeys[2];
				var newValue3 = this.data[2][2];
				this.state[key3] = newValue3;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				this.notify(message1);

				var message2 = { timestamp: this.state['Time.stamp'], value: newValue2, id: key2};
				this.notify(message2);

				var message3 = { timestamp: this.state['Time.stamp'], value: newValue3, id: key3};
				this.notify(message3);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
				storeDatum(key2, newValue2, message2, this.history, this.saveDuplicateYValues, false);
				storeDatum(key3, newValue3, message3, this.history, this.saveDuplicateYValues, false);
			}

			else if(this.data[2][0] == 'RTMT'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;
				// Vehicle Index
				var key2 = this.orderedKeys[3];
				var newValue2 = this.data[2][1];
				this.state[key2] = newValue2;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				this.notify(message1);

				var message2 = { timestamp: this.state['Time.stamp'], value: newValue2, id: key2};
				this.notify(message2);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
				storeDatum(key2, newValue2, message2, this.history, this.saveDuplicateYValues, false);

			}

			else if(this.data[2][0] == 'DRSE'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				this.notify(message1);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);

			}

			else if(this.data[2][0] == 'DRSD'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				this.notify(message1);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);

			}

			else if(this.data[2][0] == 'TMPT'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;
				// Vehicle Index
				var key2 = this.orderedKeys[4];
				var newValue2 = this.data[2][1];
				this.state[key2] = newValue2;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				this.notify(message1);

				var message2 = { timestamp: this.state['Time.stamp'], value: newValue2, id: key2};
				this.notify(message2);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
				storeDatum(key2, newValue2, message2, this.history, this.saveDuplicateYValues, false);

			}

			else if(this.data[2][0] == 'CHQF'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				this.notify(message1);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);

			}

			else if(this.data[2][0] == 'RCWN'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;
				// Vehicle Index
				var key2 = this.orderedKeys[5];
				var newValue2 = this.data[2][1];
				this.state[key2] = newValue2;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				this.notify(message1);

				var message2 = { timestamp: this.state['Time.stamp'], value: newValue2, id: key2};
				this.notify(message2);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
				storeDatum(key2, newValue2, message2, this.history, this.saveDuplicateYValues, false);

			}

			else if(this.data[2][0] == 'PENA'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;
				// Type Penalty
				var key2 = this.orderedKeys[6];
				var newValue2 = this.data[2][1];
				this.state[key2] = newValue2;
				// Type Infringment
				var key3 = this.orderedKeys[7];
				var newValue3 = this.data[2][2];
				this.state[key3] = newValue3;
				// Vehicle Index
				var key4 = this.orderedKeys[8];
				var newValue4 = this.data[2][3];
				this.state[key4] = newValue4;
				// Vehicle Index Other
				var key5 = this.orderedKeys[9];
				var newValue5 = this.data[2][4];
				this.state[key5] = newValue5;
				// Time
				var key6 = this.orderedKeys[10];
				var newValue6 = this.data[2][5];
				this.state[key6] = newValue6;
				// Lap Num
				var key7 = this.orderedKeys[11];
				var newValue7 = this.data[2][6];
				this.state[key7] = newValue7;
				// Places gained
				var key8 = this.orderedKeys[12];
				var newValue8 = this.data[2][7];
				this.state[key8] = newValue8;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				var message2 = { timestamp: this.state['Time.stamp'], value: newValue2, id: key2};
				var message3 = { timestamp: this.state['Time.stamp'], value: newValue3, id: key3};
				var message4 = { timestamp: this.state['Time.stamp'], value: newValue4, id: key4};
				var message5 = { timestamp: this.state['Time.stamp'], value: newValue5, id: key5};
				var message6 = { timestamp: this.state['Time.stamp'], value: newValue6, id: key6};
				var message7 = { timestamp: this.state['Time.stamp'], value: newValue7, id: key7};
				var message8 = { timestamp: this.state['Time.stamp'], value: newValue8, id: key8};
				this.notify(message1);
				this.notify(message2);
				this.notify(message3);
				this.notify(message4);
				this.notify(message5);
				this.notify(message6);
				this.notify(message7);
				this.notify(message8);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
				storeDatum(key2, newValue2, message2, this.history, this.saveDuplicateYValues, false);
				storeDatum(key3, newValue3, message3, this.history, this.saveDuplicateYValues, false);
				storeDatum(key4, newValue4, message4, this.history, this.saveDuplicateYValues, false);
				storeDatum(key5, newValue5, message5, this.history, this.saveDuplicateYValues, false);
				storeDatum(key6, newValue6, message6, this.history, this.saveDuplicateYValues, false);
				storeDatum(key7, newValue7, message7, this.history, this.saveDuplicateYValues, false);
				storeDatum(key8, newValue8, message8, this.history, this.saveDuplicateYValues, false);

			}

			else if(this.data[2][0] == 'SPTP'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;
				// Vehicle Index
				var key2 = this.orderedKeys[13];
				var newValue2 = this.data[2][1];
				this.state[key2] = newValue2;
				// Speed
				var key3 = this.orderedKeys[14];
				var newValue3 = this.data[2][2];
				this.state[key3] = newValue3;
				// Is Overall Fastest
				var key4 = this.orderedKeys[15];
				var newValue4 = this.data[2][3];
				this.state[key4] = newValue4;
				// Is Driver Fastest
				var key5 = this.orderedKeys[16];
				var newValue5 = this.data[2][4];
				this.state[key5] = newValue5;
				// Fastest Vehicle Index
				var key6 = this.orderedKeys[17];
				var newValue6 = this.data[2][5];
				this.state[key6] = newValue6;
				// Fastest Speed
				var key7 = this.orderedKeys[18];
				var newValue7 = this.data[2][6];
				this.state[key7] = newValue7;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				var message2 = { timestamp: this.state['Time.stamp'], value: newValue2, id: key2};
				var message3 = { timestamp: this.state['Time.stamp'], value: newValue3, id: key3};
				var message4 = { timestamp: this.state['Time.stamp'], value: newValue4, id: key4};
				var message5 = { timestamp: this.state['Time.stamp'], value: newValue5, id: key5};
				var message6 = { timestamp: this.state['Time.stamp'], value: newValue6, id: key6};
				var message7 = { timestamp: this.state['Time.stamp'], value: newValue7, id: key7};
				this.notify(message1);
				this.notify(message2);
				this.notify(message3);
				this.notify(message4);
				this.notify(message5);
				this.notify(message6);
				this.notify(message7);
				
				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
				storeDatum(key2, newValue2, message2, this.history, this.saveDuplicateYValues, false);
				storeDatum(key3, newValue3, message3, this.history, this.saveDuplicateYValues, false);
				storeDatum(key4, newValue4, message4, this.history, this.saveDuplicateYValues, false);
				storeDatum(key5, newValue5, message5, this.history, this.saveDuplicateYValues, false);
				storeDatum(key6, newValue6, message6, this.history, this.saveDuplicateYValues, false);
				storeDatum(key7, newValue7, message7, this.history, this.saveDuplicateYValues, false);

			}

			else if(this.data[2][0] == 'STLG'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;
				// Vehicle Index
				var key2 = this.orderedKeys[19];
				var newValue2 = this.data[2][1];
				this.state[key2] = newValue2;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				var message2 = { timestamp: this.state['Time.stamp'], value: newValue2, id: key2};
				this.notify(message1);
				this.notify(message2);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
				storeDatum(key2, newValue2, message2, this.history, this.saveDuplicateYValues, false);

			}

			else if(this.data[2][0] == 'LGOT'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				this.notify(message1);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
			}

			else if(this.data[2][0] == 'DTSV'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;
				// Vehicle Index
				var key2 = this.orderedKeys[20];
				var newValue2 = this.data[2][1];
				this.state[key2] = newValue2;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				var message2 = { timestamp: this.state['Time.stamp'], value: newValue2, id: key2};
				this.notify(message1);
				this.notify(message2);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
				storeDatum(key2, newValue2, message2, this.history, this.saveDuplicateYValues, false);
			}

			else if(this.data[2][0] == 'SGSV'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;
				// Vehicle Index
				var key2 = this.orderedKeys[21];
				var newValue2 = this.data[2][1];
				this.state[key2] = newValue2;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				var message2 = { timestamp: this.state['Time.stamp'], value: newValue2, id: key2};
				this.notify(message1);
				this.notify(message2);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
				storeDatum(key2, newValue2, message2, this.history, this.saveDuplicateYValues, false);
			}

			else if(this.data[2][0] == 'FLBK'){
				// Update current state
				// Code
				var key1 = this.orderedKeys[0];
				var newValue1 = this.data[2][0];
				this.state[key1] = newValue1;
				// Frame Index
				var key2 = this.orderedKeys[22];
				var newValue2 = this.data[2][1];
				this.state[key2] = newValue2;
				// Session Time
				var key3 = this.orderedKeys[23];
				var newValue3 = this.data[2][2];
				this.state[key3] = newValue3;

				// Build and send messages
				var message1 = { timestamp: this.state['Time.stamp'], value: newValue1, id: key1};
				var message2 = { timestamp: this.state['Time.stamp'], value: newValue2, id: key2};
				var message3 = { timestamp: this.state['Time.stamp'], value: newValue3, id: key3};
				this.notify(message1);
				this.notify(message2);
				this.notify(message3);

				// Store in history
				storeDatum(key1, newValue1, message1, this.history, this.saveDuplicateYValues, false);
				storeDatum(key2, newValue2, message2, this.history, this.saveDuplicateYValues, false);
				storeDatum(key3, newValue3, message3, this.history, this.saveDuplicateYValues, false);
			}
			
		}


	});
	
	server.on('error', (err) => {
		console.log(`F1_T03_Event UDP server error:\n${err.stack}`);
		try{
			console.log('Try to reconnect...')
			server.bind(53022);
		} catch(e) {
			console.log('Reconnect Failed...')
			console.log(e)
			server.close()
		}
		
	});

	// port specified in the associated python script
	server.bind(53022);

    console.log("--F1_T03_Event initialized--");
};


// to update every time new data comes in
F1_T03_Event.prototype.generateRealtimeTelemetry = function () {

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
F1_T03_Event.prototype.generateIntervalTelemetry = function () {

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
F1_T03_Event.prototype.notify = function (point) {
    this.listeners.forEach(function (l) {
        l(point);
    });
};


// manages listeners for realtime telemetry
F1_T03_Event.prototype.listen = function (listener) {
    this.listeners.push(listener);
    return function () {
        this.listeners = this.listeners.filter(function (l) {
            return l !== listener;
        });
    }.bind(this);
};

// Creating a File Timestamp 
F1_T03_Event.prototype.SetFileTimestamp = function () {

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
F1_T03_Event.prototype.clearHistoryObject = function (){
	console.log("Clear History Object - F1_T03_Event");
	Object.keys(this.history).forEach(function (k) {
		this.history[k] = [];
	}, this);
}

// Does some checks and clears history arrays if criteria met
F1_T03_Event.prototype.clearHistory = function (sessionUID, sessionTime, frameID){
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
F1_T03_Event.prototype.asyncStringyify = function (obj) {
	return new Promise((resolve, reject) => {
	  resolve(JSON.stringify(obj));
	});
  }



// what to do on incoming command
F1_T03_Event.prototype.command = function (command) {

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
			fs.writeFile(__dirname + '/saved_logs/F1_T03_Event_'+this.FileTimestamp+'_History.json', write, (err) => {
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
	// 			fs.writeFile(__dirname + '/saved_logs/F1_T03_Event_'+this.FileTimestam+'.json', write, (err) => {
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
		/// Running locally your can use localhost or 0.0.0.0, on cloud use 0.0.0.0
		//server.send(command,53023, 'localhost')
		server.send(command,53023, '0.0.0.0')
		console.log('Command Sent via UDP Port!')	
	};

	
};


module.exports = function () {
    return new F1_T03_Event()
};
