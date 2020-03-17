In a Nutshell
=============

Low level connection library to Broadlink SP WiFi-connected switches.

Basically this one takes care of probing a single IP address and
providing a way to send data to that device and receive the
response. Payload encryption is taken care of inside the library. Not
much else. This library is therefore actually only a basis for other
libraries that provide actual logic for controlling the devices and
also implements actual protocol payloads for different operations.


Reference
=========

```
const broadlinkProbe = require('broadlink-core');

async function main() {
    let dev = await broadlinkProbe('192.168.123.10', 2000);
    if (dev.devClass !== 'sp3s') {
        throw new Error('No energy meter in device');
    }
    let p = Buffer.from([8, 0, 254, 1, 5, 1, 0, 0, 0, 45, 0, 0, 0, 0, 0, 0]);
    let r = await dev.call(0x6a, p, 1000);
    // Energy reading is encoded to reply payload in most insane way imaginable.
}
```


Disclaimer
==========

I only own different SP2, SP3 and SC1 switches and can't test the
other ones. However, on this level, the communications protocol is
identical, so they would be easy to add, but since I don't have any, I
really can't test any of those, so they are not included.

If this library bricks your device or burns your house, it's not my
fault. You have been warned!


Author
======

Timo J. Rinne <tri@iki.fi>


License
=======

MIT


Acknowledgements
================

- Thanks to Ipsum Domus (https://blog.ipsumdomus.com/) for reverse
  engineering of the protocol.
