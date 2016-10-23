var crypto = require('crypto');
var MsgType = require('./type.js').MsgType;
var Type = require('./type.js');

var parent = this;

var createMessage = function(commandAndBody, msgId) {
    console.log('send ' + commandAndBody);
    var cmdBody = null;
    var cmdString = commandAndBody[0];
    var cmd = Type.getCommandByString(cmdString);
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

    return parent.buildBlynkMessage(cmd, msgId, cmdBody);
};

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

exports.createMessage = createMessage;