'use strict';

const os = require('os');

const Optist = require('optist');
const ou = require('optist/util')

const broadlinkProbe = require('./index.js');

var opt = ((new Optist())
		   .opts([ { longName: 'local-address',
					 description: 'Local IP address',
					 hasArg: true,
					 optArgCb: ou.ipv4,
					 conflictsWith: [ 'local-interface' ] },
				   { longName: 'local-interface',
					 description: 'Local network interface',
					 hasArg: true,
					 optArgCb: localNicName,
					 conflictsWith: [ 'local-address' ] },
				   { longName: 'timeout',
					 description: 'Timeout in milliseconds to wait for to answer.',
					 hasArg: true,
					 optArgCb: ou.integerWithLimitsCbFactory(1, 60000),
					 defaultValue: '1000' },
				   { longName: 'debug',
					 shortName: 'd',
					 description: 'Enable debug.' } ])
		   .help('broadlink-probe')
		   .parse(undefined, 0, 1));

function localNicName(value) {
	return (Object.keys(os.networkInterfaces()).indexOf(value) >= 0) ? value : undefined;
}

(async function() {
	try {
		let av = opt.rest();
		let addr = (av.length > 0) ? av[0] : null;
		let loc = opt.value('local-address') || opt.value('local-interface');
		let x = await broadlinkProbe(addr, opt.value('timeout'), loc);
		console.log(x);
	} catch(e) {
		console.log(e);
		process.exit(1);
	}
	process.exit(0);
})();
