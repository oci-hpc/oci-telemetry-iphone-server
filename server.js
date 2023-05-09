// main file of the telemtry server, comment/uncomment what is needed

//import the objects


var RealtimeServer = require('./realtime-server');
var HistoryServer = require('./history-server');

var HistoryReader = require('./history_reader');

//var EXAMPLE = require('./EXAMPLE');
var F1_T00_Motion               = require('./F1_T00_Motion');
var F1_T01_Session              = require('./F1_T01_Session');
var F1_T02_Lap_Data             = require('./F1_T02_Lap_Data');
var F1_T03_Event                = require('./F1_T03_Event');
var F1_T04_Participants         = require('./F1_T04_Participants');
var F1_T05_Car_Setups           = require('./F1_T05_Car_Setups');
var F1_T06_Car_Telemetry        = require('./F1_T06_Car_Telemetry');
var F1_T07_Car_Status           = require('./F1_T07_Car_Status');
var F1_T08_Final_Classification = require('./F1_T08_Final_Classification');
var F1_T09_Lobby_Info           = require('./F1_T09_Lobby_Info');
var F1_T10_Car_Damage           = require('./F1_T10_Car_Damage');
var F1_T11_Session_History      = require('./F1_T11_Session_History');

var expressWs = require('express-ws');
var app = require('express')();
expressWs(app);


// initialize the objects

//var example = new EXAMPLE;
var f1_T00_Motion               = new F1_T00_Motion;
var f1_T01_Session              = new F1_T01_Session;
var f1_T02_Lap_Data             = new F1_T02_Lap_Data;
var f1_T03_Event                = new F1_T03_Event;
var f1_T04_Participants         = new F1_T04_Participants;
var f1_T05_Car_Setups           = new F1_T05_Car_Setups;
var f1_T06_Car_Telemetry        = new F1_T06_Car_Telemetry;
var f1_T07_Car_Status           = new F1_T07_Car_Status;
var f1_T08_Final_Classification = new F1_T08_Final_Classification;
var f1_T09_Lobby_Info           = new F1_T09_Lobby_Info;
var f1_T10_Car_Damage           = new F1_T10_Car_Damage;
var f1_T11_Session_History      = new F1_T11_Session_History;

//var realtimeServerEXAMPLE = new RealtimeServer(example);
//var historyServerEXAMPLE = new HistoryServer(example);

var realtimeServerF1_T00_Motion = new RealtimeServer(f1_T00_Motion);
var historyServerF1_T00_Motion = new HistoryServer(f1_T00_Motion);

var realtimeServerF1_T01_Session = new RealtimeServer(f1_T01_Session);
var historyServerF1_T01_Session = new HistoryServer(f1_T01_Session);

var realtimeServerF1_T02_Lap_Data = new RealtimeServer(f1_T02_Lap_Data);
var historyServerF1_T02_Lap_Data = new HistoryServer(f1_T02_Lap_Data);

var realtimeServerF1_T03_Event = new RealtimeServer(f1_T03_Event);
var historyServerF1_T03_Event = new HistoryServer(f1_T03_Event);

var realtimeServerF1_T04_Participants = new RealtimeServer(f1_T04_Participants);
var historyServerF1_T04_Participants = new HistoryServer(f1_T04_Participants);

var realtimeServerF1_T05_Car_Setups = new RealtimeServer(f1_T05_Car_Setups);
var historyServerF1_T05_Car_Setups = new HistoryServer(f1_T05_Car_Setups);

var realtimeServerF1_T06_Car_Telemetry = new RealtimeServer(f1_T06_Car_Telemetry);
var historyServerF1_T06_Car_Telemetry = new HistoryServer(f1_T06_Car_Telemetry);

var realtimeServerF1_T07_Car_Status = new RealtimeServer(f1_T07_Car_Status);
var historyServerF1_T07_Car_Status = new HistoryServer(f1_T07_Car_Status);

var realtimeServerF1_T08_Final_Classification = new RealtimeServer(f1_T08_Final_Classification);
var historyServerF1_T08_Final_Classification = new HistoryServer(f1_T08_Final_Classification);

var realtimeServerF1_T09_Lobby_Info = new RealtimeServer(f1_T09_Lobby_Info);
var historyServerF1_T09_Lobby_Info = new HistoryServer(f1_T09_Lobby_Info);

var realtimeServerF1_T10_Car_Damage = new RealtimeServer(f1_T10_Car_Damage);
var historyServerF1_T10_Car_Damage = new HistoryServer(f1_T10_Car_Damage);

var realtimeServerF1_T11_Session_History = new RealtimeServer(f1_T11_Session_History);
var historyServerF1_T11_Session_History = new HistoryServer(f1_T11_Session_History);

var historyReader = new HistoryReader;
var historyServerReader = new HistoryServer(historyReader);


// use the objects

//app.use('/EXAMPLERealtime', realtimeServerEXAMPLE);
//app.use('/EXAMPLEHistory', historyServerEXAMPLE);

app.use('/F1_T00_MotionRealtime', realtimeServerF1_T00_Motion);
app.use('/F1_T00_MotionHistory', historyServerF1_T00_Motion);

app.use('/F1_T01_SessionRealtime', realtimeServerF1_T01_Session);
app.use('/F1_T01_SessionHistory', historyServerF1_T01_Session);

app.use('/F1_T02_Lap_DataRealtime', realtimeServerF1_T02_Lap_Data);
app.use('/F1_T02_Lap_DataHistory', historyServerF1_T02_Lap_Data);

app.use('/F1_T03_EventRealtime', realtimeServerF1_T03_Event);
app.use('/F1_T03_EventHistory', historyServerF1_T03_Event);

app.use('/F1_T04_ParticipantsRealtime', realtimeServerF1_T04_Participants);
app.use('/F1_T04_ParticipantsHistory', historyServerF1_T04_Participants);

app.use('/F1_T05_Car_SetupsRealtime', realtimeServerF1_T05_Car_Setups);
app.use('/F1_T05_Car_SetupsHistory', historyServerF1_T05_Car_Setups);

app.use('/F1_T06_Car_TelemetryRealtime', realtimeServerF1_T06_Car_Telemetry);
app.use('/F1_T06_Car_TelemetryHistory', historyServerF1_T06_Car_Telemetry);

app.use('/F1_T07_Car_StatusRealtime', realtimeServerF1_T07_Car_Status);
app.use('/F1_T07_Car_StatusHistory', historyServerF1_T07_Car_Status);

app.use('/F1_T08_Final_ClassificationRealtime', realtimeServerF1_T08_Final_Classification);
app.use('/F1_T08_Final_ClassificationHistory', historyServerF1_T08_Final_Classification);

app.use('/F1_T09_Lobby_InfoRealtime', realtimeServerF1_T09_Lobby_Info);
app.use('/F1_T09_Lobby_InfoHistory', historyServerF1_T09_Lobby_Info);

app.use('/F1_T10_Car_DamageRealtime', realtimeServerF1_T10_Car_Damage);
app.use('/F1_T10_Car_DamageHistory', historyServerF1_T10_Car_Damage);

app.use('/F1_T11_Session_HistoryRealtime', realtimeServerF1_T11_Session_History);
app.use('/F1_T11_Session_HistoryHistory', historyServerF1_T11_Session_History);

app.use('/HistoryReader', historyServerReader);


// start the server

var port = process.env.PORT || 16969
app.listen(port)
