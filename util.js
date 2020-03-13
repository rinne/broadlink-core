'use strict';

const ipaddr = require('ipaddr.js');
const dgram = require('dgram');

async function sock(bindAddress) {
	return new Promise(function(resolve, reject) {
		var s = dgram.createSocket('udp4');
		function listening() {
			s.removeListener('error', error);
			s.removeListener('listening', listening);
			return resolve(s);
		}
		function error(e) {
			s.close();
			return reject(e);
		}
		s.on('listening', listening);
		s.on('error', error);
		s.bind(bindAddress ? bindAddress : undefined);
	});
};

function date() {
	var d = new Date();
	return {
		timestamp: d.getTime(),
		year: d.getUTCFullYear(),
		month: d.getUTCMonth(),
		monthDay: d.getUTCDate(),
		weekDay: d.getUTCDay(),
		year: d.getUTCFullYear(),
		hour: d.getUTCHours(),
		minute: d.getUTCMinutes(),
		second: d.getUTCSeconds(),
		millisecond: d.getUTCMilliseconds()
	};
}

function checksum(b, seed) {
	var r = seed;
    for (var i = 0; i < b.length; i++) {
        r = (r + b[i]) & 0xffff;
    }
	return r;
}

function probe(localAddr, localPort) {
	let now = date();
	let o, p;
	p = Buffer.alloc(48);
	o = 12;
	p[o++] = now.year & 0xff;
	p[o++] = now.year >> 8;
	p[o++] = now.minute;
	p[o++] = now.hour;
	p[o++] = now.year % 100;
	p[o++] = now.weekDay;
	p[o++] = now.monthDay;
	p[o++] = now.month;
	o = 24;
	let ab = ipaddr.IPv4.parse(localAddr).toByteArray();
	p[o++] = ab[0];
	p[o++] = ab[1];
	p[o++] = ab[2];
	p[o++] = ab[4];
	p[o++] = localPort & 0xff;
	p[o++] = localPort >> 8;
	o = 38;
	p[o++] = 6;
	o = 32;
	let crc = checksum(p, 0xbeaf);
	p[o++] = crc & 0xff;
	p[o++] = crc >> 8;
	return p;
}

module.exports = {
	sock: sock,
	date: date,
	checksum: checksum,
	probe: probe,
};
