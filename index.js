'use strict';

const crypto = require('crypto');
//const hexl = require('hexl');
const TextDecoder = require('util').TextDecoder;
const ipaddr = require('ipaddr.js');

const devType = require('./devtype.js');
const u = require('./util.js');

var BroadlinkSwitch = function() {
	this.op = new Map();
	this.message = function(data, raddr) {
		if (! ((raddr.address === this.address) && (raddr.port === this.port))) {
			return;
		}
		let p = this.unwrap(data);
		if (p.status !== 'ok') {
			return;
		}
		let op = this.op.get(p.counter);
		if (! op) {
			return;
		}
		this.op.delete(p.counter);
		if (op.timeout) {
			clearTimeout(op.timeout);
			op.timeout = null;
		}
		op.completed = true;
		return op.resolve(p);
	}.bind(this);
};

BroadlinkSwitch.prototype.call = async function(cmd, data, timeoutMs) {
	if (! this.s) {
		throw new Error('Device closed');
	}
	if (timeoutMs) {
		if (! (Number.isSafeInteger(timeoutMs) && (timeoutMs > 0))) {
			throw new Error('Illegal timeout');
		}
	} else {
		timeoutMs = 10000;
	}
	let payload = this.wrap(cmd, data);
	let counter = this.counter;
	return new Promise(function(resolve, reject) {
		if (! this.s) {
			return reject(new Error('Device closed'));
		}
		if (this.op.has(counter)) {
			return reject(new Error('Internal error'));
		}
		let timeoutCb = function() {
			let op = this.op.get(counter);
			if (! op) {
				return;
			}
			this.op.delete(counter);
			op.timeout = null;
			op.completed = true;
			return op.reject(new Error('Timeout'));
		}.bind(this);
		let timeout = setTimeout(timeoutCb, timeoutMs);
		let ctx = { counter: counter,
					resolve: resolve,
					reject: reject,
					completed: false,
					timeout: timeout };
		this.op.set(counter, ctx);
		this.s.sendto(payload, 0, payload.length, this.port, this.address);
	}.bind(this));
};

BroadlinkSwitch.prototype.close = function() {
	if (! this.s) {
		throw new Error('Device closed');
	}
	this.s.close();
	this.s = undefined;
	this.op.forEach(function(op, counter, map) {
		map.delete(counter);
		if (op.timeout) {
			clearTimeout(op.timeout);
			op.timeout = null;
		}
		op.completed = true;
		op.reject(new Error('Device closed'));
	}.bind(this));
};

BroadlinkSwitch.prototype.wrap = function(cmd, d) {
	this.counter++;
	if ((this.counter < 1) || (this.counter > 0xffff)) {
		this.counter = 1;
	}
	let o, p = Buffer.alloc(56);
	o = 0;
    p[o++] = 0x5a;
	p[o++] = 0xa5;
	p[o++] = 0xaa;
	p[o++] = 0x55;
	p[o++] = 0x5a;
	p[o++] = 0xa5;
	p[o++] = 0xaa;
	p[o++] = 0x55;
	o = 36;
	p[o++] = 0x2a;
	p[o++] = 0x27;
	p[o++] = cmd & 0xff;
	p[o++] = cmd >> 8;
	p[o++] = this.counter & 0xff;
	p[o++] = this.counter >> 8;
	this.mac.copy(p, o);
	o += 6;
	this.id.copy(p, o);
	let crc = u.checksum(d, 0xbeaf);
	o = 52;
    p[o++] = crc & 0xff;
	p[o++] = crc >> 8;
	let cipher = crypto.createCipheriv('aes-128-cbc', this.key, this.iv);
	cipher.setAutoPadding(false);
	p = Buffer.concat( [ p, cipher.update(d), cipher.final() ] );
	crc = u.checksum(p, 0xbeaf);
	o = 32;
    p[o++] = crc & 0xff;
	p[o++] = crc >> 8;
	return p;
};

BroadlinkSwitch.prototype.unwrap = function(d) {
	function err(e) {
		return { status: 'error', error: e };
	}
	if (! ((d.length >= 56) && ((d.length - 56) % 16) == 0)) {
		return err(new Error('Truncated message'));
	}
	let crc = d.readUInt16LE(32);
    d[32] = 0;
	d[33] = 0;
	if (crc != u.checksum(d, 0xbeaf)) {
		return err(Error('CRC mismatch in outer envelope checksum'));
	}
	let decipher = crypto.createDecipheriv('aes-128-cbc', this.key, this.iv);
	decipher.setAutoPadding(false);
	let p = Buffer.concat( [ decipher.update(d.slice(56)), decipher.final() ] );
	crc = d.readUInt16LE(52);
	if (crc != u.checksum(p, 0xbeaf)) {
		return err(new Error('CRC mismatch in inner envelope checksum'));
	}
	if (this.mac.compare(d, 42, 48)) {
		return err(new Error('MAC address mismatch in message header'));
	}
	if (this.id.compare(d, 48, 52)) {
		return err(new Error('Device ID mismatch in message header'));
	}
	let errorCode = d.readUInt16LE(34);
	let cmd = d.readUInt16LE(38);
	let ctr = d.readUInt16LE(40);
	if (cmd == 0x3e9) {
		if (p.length < 20) {
			return err(new Error('Truncated key update payload'));
		}
		this.id = p.slice(0, 4);
		this.key = p.slice(4, 20);
		this.keySet++;
	}
	let r = { status: ((errorCode == 0) ? 'ok' : 'error'), counter: ctr, command: cmd, error: errorCode };
	//hexl.log(d, JSON.stringify(r, null, 2));
	r.header = d.slice(0, 56);
	r.payload = p;
	return r;
};

async function broadlinkProbe(ip, timeoutMs, localIp) {
	var port = 80, broadcast;
	var timestamp = Date.now();
	var dev;

	return (Promise.resolve()
			.then(function() {
				if (timeoutMs) {
					if (! (Number.isSafeInteger(timeoutMs) && (timeoutMs > 0))) {
						throw new Error('Illegal timeout');
					}
				} else {
					timeoutMs = 10000;
				}
				if ((! ip) || (['0.0.0.0', '0.0.0.0/0', '255.255.255.255', '255.255.255/0'].indexOf(ip) >= 0)) {
					if (! localIp) {
						throw new Error('Broadcast requires local address or interface name');
					}
					let ba =  u.findBroadcastAddresses(localIp);
					ip = ba.broadcast;
					localIp = ba.local;
					broadcast = [];
				} else {
					ipaddr.IPv4.parse(ip);
					if (localIp) {
						localIp = u.findBroadcastAddresses(localIp).local;
					}
				}
				return u.sock(localIp ? localIp : undefined);
			})
			.then(function(ret) {
				var s = ret;
				if (broadcast) {
					s.setBroadcast(true);
				}
				return new Promise(function(resolve, reject) {
					let completed = false;
					let timeout, o, p;
					let laddr = s.address().address;
					let lport = s.address().port;
					completed = false;
					p = u.probe(laddr, lport);
					s.sendto(p, 0, p.length, port, ip);
					function timeoutCb() {
						timeout = undefined;
						if (completed) {
							return;
						}
						if (broadcast) {
							return resolve();
						}
						error(new Error('Timeout'));
					}
					function error(e) {
						if (completed) {
							return;
						}
						completed = true;
						if (timeout) {
							clearTimeout(timeout);
							timeout = undefined;
						}
						try {
							s.close();
							s = undefined;
						} catch(ignored) {
							s = undefined;
						}
						return reject(e);
					}
					function message(d, raddr) {
						//hexl.log(d, "recv:\n" + JSON.stringify(raddr, null, 2));
						if (completed) {
							return;
						}
						if (! (((raddr.address === ip) || broadcast) && (raddr.port === port))) {
							return;
						}
						if (! (d.length == 128)) {
							return;
						}
						let crc = d.readUInt16LE(32);
						d[32] = 0;
						d[33] = 0;
						if (crc != u.checksum(d, 0xbeaf)) {
							return;
						}
						let id = d.readUInt16LE(52);
						let di = devType(id);
						if (! di) {
							let m = 'Unrecognized device type 0x' + ('000' + id.toString(16)).slice(-4);
							error(new Error(m));
							return;
						}
						let mac = Buffer.from([ d[63], d[62], d[61], d[60], d[59], d[58] ]);
						dev = new BroadlinkSwitch();
						dev.uid = 'broadlink.' + di.devClass + '.' + mac.toString('hex');
						dev.name = 'Unknown ' + di.devType;
						dev.address = raddr.address;
						dev.port = raddr.port;
						dev.mac = mac;
						dev = Object.assign(dev, di);
						if (broadcast) {
							delete dev.message;
							broadcast.push(dev);
							return;
						}
						dev.id = Buffer.alloc(4);
						dev.key = Buffer.from([0x09, 0x76, 0x28, 0x34, 0x3f, 0xe9, 0x9e, 0x23,
											   0x76, 0x5c, 0x15, 0x13, 0xac, 0xcf, 0x8b, 0x02]),
						dev.iv = Buffer.from([0x56, 0x2e, 0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28,
											  0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58]),
						dev.counter = Math.floor((Math.random() * 0x10000));
						dev.keySet = 0;
						try {
							let name = d.slice(64, 124);
							let end = 0;
							while ((end < name.length) && (name[end] != 0)) {
								end++;
							}
							name = name.slice(0, end);
							let td = new TextDecoder('utf8', { fatal: true });
							name = td.decode(name);
							dev.name = name;
						} catch(ignored) {
						}
						if (timeout) {
							clearTimeout(timeout);
							timeout = undefined;
						}
						s.removeListener('message', message);
						s.removeListener('error', error);
						completed = true;
						dev.s = s;
						s.on('message', dev.message);
						s = undefined;
						return resolve();
					}
					timeout = setTimeout(timeoutCb, timeoutMs);
					s.on('message', message);
				});
			})
			.then(function() {
				if (broadcast) {
					return;
				}
				let o, p;
				p = Buffer.alloc(80);
				o = 4;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				p[o++] = 0x31;
				o = 30;
				p[o++] = 0x01;
				o = 45;
				p[o++] = 0x01;
				o = 48;
				p.write('Test  1', o);
				timeoutMs -= (Date.now() - timestamp);
				if (timeoutMs < 1) {
					throw new Error('Timeout');
				}
				return dev.call(0x65, p, timeoutMs);
			})
			.then(function(ret) {
				if (broadcast) {
					return broadcast;
				}
				if (! dev.keySet) {
					throw new Error('Key setup failure');
				}
				return dev;
			})
			.catch(function(e) {
				if (dev && dev.s) {
					try {
						dev.close();
					} catch(ignored) {
					}
				}
				throw e;
			}));
}

module.exports = broadlinkProbe;
