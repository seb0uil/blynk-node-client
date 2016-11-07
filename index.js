'use strict';

var tls = require('tls');
var MsgType = require('./type.js').MsgType;
var Message = require('./message.js');
var EventEmitter = require('events');

var options = {
    rejectUnauthorized: false
};

var msgId = 1;
var socket;
var parent = this;
var event = new EventEmitter();

parent.respPromises = new Map();

parent.send = function(data, resolve, reject) {
    var commandAndBody = data.split(" ");
    var message = Message.createMessage(commandAndBody, msgId++);
    parent.socket.write(message, function(err) {
      if (err) {
        reject(err);
      }
    });
};

var disconnect = function() {
    return new Promise(function (resolve, reject) {
        resolve('done');
    });
};

var connect = function(login, pwd, host, port) {
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

        parent.socket.on('error', function(err) {
            reject(err);
        });

        parent.socket.on('data', function(data) {
            var msgId = data.readUInt16BE(1);
            var r =	parent.respPromises.get(msgId);

            var innerResolve = function(msgType, fields, resp, result) {
                var dashId;
                if (typeof r !== 'undefined') {
                    r.resolve(fields);
                }

                resp.trim && (resp = resp.trim());

                dashId = resp.substr(0, 1);

                /* Emit generic message */
                event.emit('message', result, fields, resp);
                /* Emit message for type */
                switch (msgType) {
                    case MsgType.SYNC:
                        event.emit('sync', result, fields, resp);
                        break;
                }
                /* Emit message for dashboard update */
                try {
                    event.emit('dash' + dashId, result, fields, resp);
                } catch (e) {
                    event.emit('message', result, fields, resp);
                }
                /* Emit specific message for pin (d1, v5 etc..) */
                try {
                    var trigger = dashId + resp.substr(2, 1) + resp.substr(5, 1);
                    event.emit(trigger, result, fields, resp);
                } catch (e) {
                    event.emit('message', result, fields, resp);
                }
            };

            switch (data[0]) {
                case MsgType.RESPONSE:
                    if (typeof (r) !== 'undefined') {
                        var responseCode = data.readUInt16BE(3);
                        r.resolve(responseCode);
                    }
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
                    var resp = data.toString('utf8', 5);
                    var fields = resp.split('\0');
                    innerResolve(data[0], fields, resp);
                    break;
            }
            parent.respPromises.delete(msgId);
        });
    });
};

function sendQ(command) {
    return new Promise(function (resolve, reject) {
        parent.respPromises.set(msgId, {
            "resolve": resolve,
            "reject": reject
        });
        parent.send(command, resolve, reject);
    })
}

var hardware = function(dashboardId, pinType, pinCommand, pinId, pinValue) {
    var command = "hardware " + dashboardId + " " + pinType + pinCommand + " " + pinId;
    if (pinValue != undefined)
        command = command + " " + pinValue;
    if (pinCommand === 'r') {
        return sendQ(command)
    } else {
        return new Promise(function (resolve, reject) {
            parent.send(command);
            setTimeout(function () {
                resolve('done');
            }, 2000);
        })
    };
};

var getToken = function(dashboardId) {
    var command = "getToken " + dashboardId;
    return sendQ(command)
};

var activate = function(dashboardId) {
    var command = "activate " + dashboardId;
    return sendQ(command);
};

var profile = function() {
    var command = "activate " + dashboardId;
    return sendQ(command);
};

var notify = function(message) {
    var command = MsgType.NOTIFY + [message];
    return sendQ(command);
};

var ping = function() {
    var command = "ping";
    return sendQ(command);
};

var raw= function(raw) {
    return sendQ(raw);
};

exports.getToken = getToken;
exports.connect = connect;
exports.disconnect = disconnect;
exports.hardware = hardware;
exports.activate = activate;
exports.ping = ping;
exports.notify = notify;
exports.event = event;
exports.raw = raw;