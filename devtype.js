'use strict';

function devType(typeId) {
	var r;
	switch (typeId) {
	case 0:
		r = { devClass: 'sp1', devType: 'Broadlink SP1' };
		break;
	case 0x2711:
		r = { devClass: 'sp2', devType: 'Broadlink SP2' };
		break;
	case 0x2719:
	case 0x7919:
	case 0x271a:
	case 0x791a:
		r = { devClass: 'sp2', devType: 'Honeywell SP2' };
		break;
	case 0x2720:
		r = { devClass: 'sp2', devType: 'Broadlink SP-Mini' };
		break;
    case 0x7547:
		r = { devClass: 'sc1', devType: 'Broadlink SC1' };
		break;
	case 0x753e:
		r = { devClass: 'sp3', devType: 'Broadlink SP3' };
		break;
	case 0x947a:
	case 0x9479:
		r = { devClass: 'sp3s', devType: 'Broadlink SP3S' };
		break;
	case 0x2728:
		r = { devClass: 'sp2', devType: 'Broadlink SP-Mini2' };
		break;
	case 0x2733:
	case 0x273e:
		r = { devClass: 'sp2', devType: 'Contros SP-Mini' };
		break;
	case 0x2736:
		r = { devClass: 'sp2', devType: 'Broadlink SP-MiniPlus' };
		break;
	case 0x7530:
	case 0x7546:
	case 0x7918:
		r = { devClass: 'sp2', devType: 'SP-Mini2 (OEM)' };
		break;
	case 0x7d0d:
		r = { devClass: 'sp3', devType: 'SP-Mini3 (OEM)' };
		break;
	case 0x7d00:
		r = { devClass: 'sp3', devType: 'SP3 (OEM)' };
		break;
    case 0x6111:
		r = { devClass: 'mcb1', devType: 'Broadlink MCB1' };
		break;
	case 0x2714:
		r = { devClass: 'a1', devType: 'Broadlink A1 e-Air' };
		break;
	default:
		break;
	}
	if (r) {
		r.devTypeId = typeId;
	}
	return r;
}

module.exports = devType;
