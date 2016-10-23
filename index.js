var tls = require('tls');
var MsgType = require('./type.js').MsgType;
var Message = require('./message.js');
var EventEmitter = require('events');

var options = {
	rejectUnauthorized: false
};

var msgId = 0;
var socket;
var parent = this;
var event = new EventEmitter();

parent.respPromises = new Map();

parent.send = function(data) {
	var commandAndBody = data.split(" ");
	var message = Message.createMessage(commandAndBody, parent.msgId++);
	parent.socket.write(message);
};

hardware = function(dashboardId, pinType, pinCommand, pinId, pinValue) {
	var command = "hardware " + dashboardId + " " + pinType + pinCommand + " " + pinId;
	if (pinValue != undefined)
		command = command + " " + pinValue;
	return new Promise(function (resolve, reject) {
		if (pinCommand === 'r') {
			resolve('done');
		} else {
			parent.respPromises.set(msgId, {
				"resolve": resolve,
				"reject": reject
			});
		}
		parent.send(command);
	})
}


connect = function(login, pwd, host, port) {
	var innerConnect = function(host, port) {
		return new Promise(function (resolve, reject) {
			parent.socket = tls.connect(port, host, options,resolve);
		})
	};

	return new Promise(function (resolve, reject) {
		parent.respPromises.set(msgId, {
			"resolve": resolve,
			"reject": reject
		});


		innerConnect(host, port)
			.then(
				parent.send('login ' + login + ' ' + pwd)
			);


		parent.socket.on('data', function(data) {
			var msgId = data.readUInt16BE(1);
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
        parent.respPromises.set(msgId, {
			"resolve": resolve,
			"reject": reject
		});
		parent.send(command);
	})
};

activate = function(dashboardId) {
	var command = "activate " + dashboardId;
	return new Promise(function (resolve, reject) {
		parent.respPromises.set(msgId, {
			"resolve": resolve,
			"reject": reject
		});
		parent.send(command);
	})
};

sync = function(dashboardId) {
	var command = "sync"; // + dashboardId;
	return new Promise(function (resolve, reject) {
        parent.respPromises.set(msgId, {
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
exports.event = event;