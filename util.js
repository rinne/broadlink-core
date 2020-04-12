'use strict';

const os = require('os');
const dgram = require('dgram');

const ipaddr = require('ipaddr.js');

const RndGen = require('rndgen');
const rndGen = new RndGen();
const rndInt = function() { return rndGen.getInt.apply(rndGen, arguments); };

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
		s.bind(null, bindAddress ? bindAddress : undefined);
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

function defaultKey() {
	return { key: Buffer.from([0x09, 0x76, 0x28, 0x34, 0x3f, 0xe9, 0x9e, 0x23,
							   0x76, 0x5c, 0x15, 0x13, 0xac, 0xcf, 0x8b, 0x02]),
			 iv: Buffer.from([0x56, 0x2e, 0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28,
							  0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58]) };
}

function findBroadcastAddresses(localIpOrNicName) {
	var nic = os.networkInterfaces(), r;
	if (nic[localIpOrNicName]) {
		nic[localIpOrNicName].some(function(a) {
			if ((a.family === 'IPv4') && (typeof(a.address) === 'string') && (typeof(a.cidr) === 'string')) {
				r = { local: a.address, broadcast: ipaddr.IPv4.broadcastAddressFromCIDR(a.cidr).toString() };
				return true;
			}
			return false;
		});
	} else if (ipaddr.IPv4.isValid(localIpOrNicName)) {
		Object.keys(nic).some(function(n) {
			var x = nic[n].some(function(a) {
				if ((a.family === 'IPv4') && (a.address === localIpOrNicName) && (typeof(a.cidr) === 'string')) {
					r = { local: a.address, broadcast: ipaddr.IPv4.broadcastAddressFromCIDR(a.cidr).toString() };
					return true;
				}
				return false;
			});
			return x;
		});
	} else {
		throw new Error('Valid IP address or existing NIC name required');
	}
	if (r) {
		return r;
	}
	throw new Error('Unable to find matching local address');
}

module.exports = {
	sock: sock,
	date: date,
	checksum: checksum,
	probe: probe,
	findBroadcastAddresses: findBroadcastAddresses,
	rndInt: rndInt,
	defaultKey: defaultKey
};
