var getCommandByString = function(cmdString) {
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
        default:
            return cmdString;
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

exports.MsgType = MsgType;
exports.getCommandByString = getCommandByString;