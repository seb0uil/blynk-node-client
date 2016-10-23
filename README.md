[![npm version](https://badge.fury.io/js/blynk-client.svg)](https://badge.fury.io/js/blynk-client) 
[![Dependency Status](https://david-dm.org/seb0uil/blynk-client.svg)](https://david-dm.org/seb0uil/blynk-client) 
[![npm](https://img.shields.io/npm/dm/blynk-client.svg?maxAge=2592000)](https://www.npmjs.com/package/blynk-client)


blynk-client
================

Simple node module to get manage blynk.

```bash
$ npm install blynk-client
```

Then get json information of your account
```bash
 var c = require('blynk-client');  
 var p = c.connect('@mail','password','server',port);  
```

You can set pin value
```bash
p.then(function(){
    return c.hardware('2','v','w',1, 25);  //dashboardId, pinType, read/write, pinId, [value]
})
```

Or listen event
```bash
c.event.on('message', function(a) {
 console.log('MESSAGE:  ' + JSON.stringify(a) );
});
```
Events are

 - message : for all type of message events
 - dashboard : for dashboard events
 - [pinType][pinId] (ie v1 or d1 for example) : for pin event
 - sync : for sync event
