var socket;
var retry_count = -1;
var settings = {printer: {temperature_scale:"C", nozzle_temperatures:"", bed_temperatures:""}};

function connect(){
	disconnect()
	
	socket = new SockJS(BASE_URL+"sockjs/");
	
	socket.timeoutInterval = 30;
	socket.maxReconnectAttempts = 10;
	
	socket.onopen = function() {
		getSettings();
		switchView("main");
		sendSwitchCommand("status");
		retry_count = -1;
	};
	
	socket.onmessage = function(e) {
		if(currentView === "disconnected" || currentView === "loading" ){
			switchView("main");
		}
		onReceivedData(e.data);
	}; 
	
	socket.onclose = function(e) {
		if (e.code == 1000 ) { //{type: "close", code: 1000, reason: "Normal closure", wasClean: true}
			switchView("disconnected");
			stop_camera(true); //stop camera imediatly
		} else { //{type: "close", code: 1006, reason: "WebSocket connection broken", wasClean: false}
			protocol_error({status: 503, statusText:"Service Unavailable", responseText:"Server is offline."})
		}
	};

}

function disconnect(){
	if (socket != undefined){
		socket.close();
	}
}

//conection commands
function sendConnectionCommand(command){
		$.ajax({
			url:  BASE_URL+"api/connection",
			headers: {"X-Api-Key": API_KEY},
			method: "POST",
			timeout: 10000,
			contentType: "application/json",
			data: JSON.stringify({"command": command})
		});
}

function getConnectionStatus(callback){
		$.ajax({
			url:  BASE_URL+"api/connection",
			headers: {"X-Api-Key": API_KEY},
			method: "GET",
			timeout: 10000,
			contentType: "application/json"
		}).done(function(data){if (typeof callback === "function") callback(data);});
}

function getExtruderCountFromProfile(callback){
		$.ajax({
			url:  BASE_URL+"api/printerprofiles",
			headers: {"X-Api-Key": API_KEY},
			method: "GET",
			timeout: 10000,
			contentType: "application/json"
		}).done(function(data){if (typeof callback === "function") callback(data);});
}

//files commands
function sendLoadFile(filename){
		$.ajax({
			url:  BASE_URL+"api/files/local/"+filename,
			headers: {"X-Api-Key": API_KEY},
			method: "POST",
			timeout: 10000,
			contentType: "application/json",
			data: JSON.stringify({"command": "select"})
		});
}

function getFileInfo(filename){
	$.ajax({
		url:  BASE_URL+"api/files/local/"+filename,
		headers: {"X-Api-Key": API_KEY},
		method: "GET",
		timeout: 10000,
		contentType: "application/json",
	}).done(function(data){ if (data.userdata != "undefined") printer.fileInfo(data.userdata);});
}


function getGcodeFiles(callback){
		$.ajax({
			url:  BASE_URL+"api/files",
			headers: {"X-Api-Key": API_KEY},
			method: "GET",
			timeout: 10000,
			contentType: "application/json",
		}).done(function(data){if (typeof callback === "function") callback(data);});
}

//job commands
function sendJobCommand(command){
		$.ajax({
			url:  BASE_URL+"api/job",
			headers: {"X-Api-Key": API_KEY},
			method: "POST",
			timeout: 10000,
			contentType: "application/json",
			data: JSON.stringify({"command": command})
		});
}

function sendCommandByName(name){
	var gcode = settings.action[name];
	if (gcode != undefined) {
		sendCommand( gcode.split(",") );
	}
}

//G or M codes
function sendCommand(data){
	if (typeof data  === "string") {
		command = {"command": data};
	} else {
		command = {"commands": data};
	}
	$.ajax({
		url:  BASE_URL+"api/printer/command",
		headers: {"X-Api-Key": API_KEY},
		method: "POST",
		timeout: 10000,
		contentType: "application/json",
		data: JSON.stringify(command)
	});
}

//switch plugin
function sendSwitch(data, callback){
	if (has_switch()) {
		$.ajax({
			url:  BASE_URL+"api/plugin/switch",
			headers: {"X-Api-Key": API_KEY},
			method: "POST",
			timeout: 10000,
			contentType: "application/json",
			data: JSON.stringify(data),
			
		}).done(function(){if (typeof callback === "function") callback();});
	} else {
		if (typeof callback === "function") callback();
	}
}

function sendSwitchCommand(command, status){
	if (status != undefined){
		sendSwitch({"command":command, "status":status}, function(){sendSwitchCommand("status");});
	} else {
		sendSwitch({"command":command});
	}
}

//mobile plugin
function checkHome(callback){
	$.ajax({
		url:  MOBILE_URL+"/home",
		headers: {"X-Api-Key": API_KEY},
		method: "GET",
		timeout: 10000,
		contentType: "application/json",
		error: protocol_error
	}).done(function(data){if (typeof callback === "function") callback(data);});
}


function getSettings(){
	$.ajax({
		url:  MOBILE_URL+"/settings/"+localStorage.getItem("mobile.settings.uid"),
		headers: {"X-Api-Key": API_KEY},
		method: "GET",
		timeout: 10000,
		contentType: "application/json"
	}).done( function(data){
		if (typeof(data) === "string") {
			data = JSON.parse(data);
		}		
		if (data.update){
			localStorage.setItem("mobile.settings.uid", data.id);
			
			settings.profile = data.profile;
			settings.printer = data.printer;
			
			if (settings.printer.temperature_scale == "C") {
				settings.printer.temperature_scale = "ºC"
			}
			settings.printer.nozzle_temperatures = settings.printer.nozzle_temperatures.split(",")
			settings.printer.bed_temperatures = settings.printer.bed_temperatures.split(",")

			settings.offset = data.offset;
			settings.action = data.action;
			
			localStorage.setItem("mobile.profile", JSON.stringify(data.profile));
			localStorage.setItem("mobile.printer", JSON.stringify(data.printer));
			localStorage.setItem("mobile.offset", JSON.stringify(data.offset));
			localStorage.setItem("mobile.action", JSON.stringify(data.action));
		} else {
			settings.profile = JSON.parse(localStorage.getItem("mobile.profile"));
			settings.printer = JSON.parse(localStorage.getItem("mobile.printer"));
			settings.offset = JSON.parse(localStorage.getItem("mobile.offset"));
			settings.action = JSON.parse(localStorage.getItem("mobile.action"));
		}
		offset.m1(settings.offset.macro_1);
		offset.m2(settings.offset.macro_2);
		offset.m3(settings.offset.macro_3);
		offset.m4(settings.offset.macro_4);
		
		createHotendSliders( settings.printer.nozzle_temperatures );
		createBedSliders( settings.printer.bed_temperatures );
	 	if (! printer.acceptsCommands() ){
			$("input.temp_slider").slider('disable');
	 	}
	});
}

function unselect(){
	$.ajax({
		url:  MOBILE_URL+"/unselect",
		headers: {"X-Api-Key": API_KEY},
		method: "GET",
		timeout: 10000,
		contentType: "application/json"
	});
}


//error handling
function protocol_error(reason) {
	disconnect(); //just in case
	switchView("disconnected");	
	switch (reason.status) {
		case 401:  //UNAUTHORIZED
			$("#disconnected_message").html(reason.responseText);
			$("#reconnect").click(function(){
				checkHome(function(data){
					home = data.home;
					initialize();
				});
			});
			break;
		case 503:  //Service Unavailable
			$("#disconnected_message").html("Server is offline.");
			if (retry_count == -1) retry_count = 10;
			if (retry_count > 0) {
				$("#reconnect_message").html(sprintf(" Attempt to reconnect (%s)", retry_count) );
				retry_count = retry_count - 1;
				setTimeout(function(){
					connect();
				}, 10000);
			} else $("#reconnect_message").html(" Attempt to reconnect");
			break;
		default: //retry for a while
			$("#disconnected_message").html("Server is offline.");
			if (retry_count == -1) retry_count = 20;
			if (retry_count > 0) {
				$("#reconnect_message").html(sprintf(" Attempt to reconnect (%s)", retry_count) );
				retry_count = retry_count - 1;
				setTimeout(function(){
					connect();
				}, 5000);
			} else $("#reconnect_message").html(" Attempt to reconnect");
	}
}

