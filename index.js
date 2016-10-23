var tls = require('tls');
var crypto = require('crypto');
const EventEmitter = require('events');

var options = {
	rejectUnauthorized: false
};

var socket;
var parent = this;
var event = new EventEmitter();

parent.respPromises = new Map();
parent.message = [];

parent.send = function(data) {
	var commandAndBody = data.split(" ");
	var message = parent.createMessage(commandAndBody);
	parent.socket.write(message);
}

this.msgId = 0;
parent.createMessage = function(commandAndBody) {
	console.log('send ' + commandAndBody);
	var cmdBody = null;
	var cmdString = commandAndBody[0];
	var cmd = getCommandByString(cmdString);
	if (cmd == MsgType.LOGIN) {
		var username = commandAndBody[1];
		var pwd = commandAndBody[2];
		var hUser = crypto.createHash('sha256');
		var hPwd = crypto.createHash('sha256');
		var salt = hUser.update(username.toLowerCase()).digest();
		hPwd.update(pwd, "utf8");
		hPwd.update(salt, "utf8");
		var finalHash = hPwd.digest('base64');
		cmdBody = username + "\0" + finalHash;
	} else if (cmd == MsgType.CREATE_DASH || cmd == MsgType.CREATE_WIDGET) {
		cmdBody = commandAndBody.length > 1 ? commandAndBody.slice(1).join(' ') : null;
	} else{
		cmdBody = commandAndBody.length > 1 ? commandAndBody.slice(1).join('\0') : null;
	}

	return parent.buildBlynkMessage(cmd, parent.msgId++, cmdBody);
}

parent.buildBlynkMessage = function(cmd, msgId, cmdBody) {
	const BLYNK_HEADER_SIZE = 5;
	var bodyLength = (cmdBody ? cmdBody.length : 0);

	var bufArray = new ArrayBuffer(BLYNK_HEADER_SIZE + bodyLength);
	var dataview = new DataView(bufArray);
	dataview.setInt8(0, cmd);
	dataview.setInt16(1, msgId);
	dataview.setInt16(3, bodyLength);

	if (bodyLength > 0) {
		//todo optimize. should be better way
		var buf = new ArrayBuffer(bodyLength); // 2 bytes for each char
		var bufView = new Uint8Array(buf);
		for (var i = 0, offset =  5; i < cmdBody.length; i++, offset += 1) {
			dataview.setInt8(offset, cmdBody.charCodeAt(i));
		}
	}
	return new Buffer(bufArray);
}

function getCommandByString(cmdString) {
	switch (cmdString) {
		case "ping" :
			return MsgType.PING;
		case "login" :
			return MsgType.LOGIN;
		case "getToken" :
			return MsgType.GET_TOKEN;
		case "createDash":
			return MsgType.CREATE_DASH;
		case "deleteDash":
			return MsgType.DELETE_DASH;
		case "activate":
			return MsgType.ACTIVATE_DASHBOARD;
		case "createWidget":
			return MsgType.CREATE_WIDGET;
		case "hardware" :
			return MsgType.HARDWARE;
		case "loadprofilegzipped" :
			return MsgType.LOAD_PROFILE_GZIPPED;
	}
}

var MsgType = {
	RESPONSE      		:  0,
	LOGIN         		:  2,
	GET_TOKEN			:  5,
	PING          		:  6,
	ACTIVATE_DASHBOARD	:  7,
	DEACTIVATE_DASHBOARD:  8,
	TWEET         		:  12,
	EMAIL         		:  13,
	NOTIFY        		:  14,
	BRIDGE        		:  15,
	HW_SYNC       		:  16,
	HW_INFO       		:  17,
	HARDWARE      		:  20,
	LOAD_PROFILE_GZIPPED:  24,
	SYNC				:  25,
	CREATE_DASH			:  21,
	DELETE_DASH 		:  23,
	CREATE_WIDGET		:  33
};


hardware = function(dashboardId, pinType, pinCommand, pinId, pinValue) {
	var command = "hardware " + dashboardId + " " + pinType + pinCommand + " " + pinId;
	if (pinValue != undefined)
		command = command + " " + pinValue;
	return new Promise(function (resolve, reject) {
//		if (pinCommand === 'r') {
//			resolve('done');
//		} else {
			parent.respPromises.set(parent.msgId, {
				"resolve": resolve,
				"reject": reject
			});
//		}
		parent.send(command);
	})
}

//
connect = function(login, pwd, host, port) {
	var innerConnect = function(host, port) {
		return new Promise(function (resolve, reject) {
			parent.socket = tls.connect(port, host, options,resolve);
		})
	};

	return new Promise(function (resolve, reject) {

		parent.respPromises.set(parent.msgId, {
			"resolve": resolve,
			"reject": reject
		});


		innerConnect(host, port)
			.then(
				parent.send('login ' + login + ' ' + pwd)
			);
		//parent.socket = tls.connect(port, host, options,function() {
		//	parent.send('login ' + login + ' ' + pwd);
		//})

		parent.socket.on('data', function(data) {
			var msgId = data.readUInt16BE(1);

			//console.log('get response for messageId ' + msgId);
			var r =	parent.respPromises.get(msgId);

			var innerResolve = function(msgType, fields, resp, result) {
				if (typeof r !== 'undefined') {
					r.resolve(fields);
				}

				resp.trim && (resp = resp.trim());
				/* Emit generic message */
				event.emit('message', result, fields, resp);
				/* Emit message for type */
				switch (msgType) {
					case MsgType.SYNC:
						event.emit('sync', result, fields, resp);
						break;
				}
				/* Emit message for dashboard uddate */
				try {
					var dashId = resp.substr(0, 1);
					event.emit('dash' + dashId, result, fields, resp);
				} catch (e) {
					event.emit('message', result, fields, resp);
				}
				/* Emit specific message for pin (d1, v5 etc..) */
				try {
					var trigger = resp.substr(2, 1) + resp.substr(5, 1);
					event.emit(trigger, result, fields, resp);
				} catch (e) {
					event.emit('message', result, fields, resp);
				}
			};

			switch (data[0]) {
				case MsgType.RESPONSE:
					var responseCode = data.readUInt16BE(3);
					r.resolve(responseCode);
					break;
				case MsgType.SYNC:
				case MsgType.HARDWARE:
					var resp = data.toString('utf8', 5);
					var fields = resp.split('\0');
					var result = {
						dashboardId : fields[0],
						pin : fields[1].substr(0,1) + fields[2],
						value : fields[fields.length-2]
					};
					innerResolve(data[0], fields, resp, result);
					break;
				case MsgType.GET_TOKEN:
					var resp = data.toString('utf8', 5);
					console.log('token ' + resp);
					r.resolve(resp);
					break;
				case MsgType.LOAD_PROFILE_GZIPPED:
					var buf = new Buffer(data.length - 5);
					data.copy(buf, 0, 5);
					zlib.unzip(buf, function(err, buffer) {
						if (typeof err === 'undefined') {
							var resp = buffer.toString('utf8');
							r.resolve(resp);
						} else {
							r.reject(err);
						}
					});
					break;
				case MsgType.ACTIVATE_DASHBOARD:
				case MsgType.DEACTIVATE_DASHBOARD:
					break;
				default:
					innerResolve(data[0], fields, resp);
					//r.resolve("Response raw data: " + data);
					break;
			}
			parent.respPromises.delete(msgId);
		});
	});
};

getToken = function(dashboardId) {
	var command = "getToken " + dashboardId;
	return new Promise(function (resolve, reject) {
		parent.respPromises.set(parent.msgId, {
			"resolve": resolve,
			"reject": reject
		});
		parent.send(command);
	})
};

activate = function(dashboardId) {
	var command = "activate " + dashboardId;
	return new Promise(function (resolve, reject) {
		parent.respPromises.set(parent.msgId, {
			"resolve": resolve,
			"reject": reject
		});
		parent.send(command);
	})
};

sync = function(dashboardId) {
	var command = "sync"; // + dashboardId;
	return new Promise(function (resolve, reject) {
		parent.respPromises.set(parent.msgId, {
			"resolve": resolve,
			"reject": reject
		});
		parent.send(command);
	})
};

exports.getToken = getToken;
exports.connect = connect;
exports.hardware = hardware;
exports.activate = activate;
exports.sync = sync;
exports.MsgType = MsgType;
exports.event = event;