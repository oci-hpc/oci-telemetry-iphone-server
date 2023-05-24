// main file of the telemtry server, comment/uncomment what is needed

//import the objects

var RealtimeServer = require('./realtime-server');
var HistoryServer = require('./history-server');

var HistoryReader = require('./history_reader');

//var EXAMPLE = require('./EXAMPLE');

var expressWs = require('express-ws');
var iPhone_SensorLog = require('./iPhone_SensorLog');
var app = require('express')();
expressWs(app);


// initialize the objects

//var example = new EXAMPLE;
var iphone_SensorLog = new iPhone_SensorLog;

//var realtimeServerEXAMPLE = new RealtimeServer(example);
//var historyServerEXAMPLE = new HistoryServer(example);

var realtimeServeriPhone_SensorLog = new RealtimeServer(iphone_SensorLog);
var historyServeriPhone_SensorLog = new HistoryServer(iphone_SensorLog);

var historyReader = new HistoryReader;
var historyServerReader = new HistoryServer(historyReader);

// use the objects

//app.use('/EXAMPLERealtime', realtimeServerEXAMPLE);
//app.use('/EXAMPLEHistory', historyServerEXAMPLE);

app.use('/iPhone_SensorLogRealtime', realtimeServeriPhone_SensorLog);
app.use('/iPhone_SensorLogHistory', historyServeriPhone_SensorLog);

app.use('/HistoryReader', historyServerReader);


// start the server

var port = process.env.PORT || 16969
app.listen(port)
