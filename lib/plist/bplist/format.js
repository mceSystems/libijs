/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	magic: Buffer.from("bplist"),
	version: Buffer.from("00"),

	trailer: {
		size: 32,
		padding: Buffer.alloc(6),
		indices: {
			offsetSize:			0,
			objectRefSize:		1,
			objectCount:		2,
			topObject:			10,
			offsetTableOffset:	18,
		},
	},

	types: {
		null:			0x00,
		false:			0x08,
		true:			0x09,
		int:			0x10,
		real:			0x20,
		date:			0x30,
		data:			0x40,
		asciiString:	0x50,
		utf16String:	0x60,
		uid:			0x80,
		array:			0xA0,
		set:			0xC0,
		dict:			0xD0,
	},

	numberSizes: {
		uint8: {
			bytes: 1,
			forMarker: 0,
		},
		uint16: {
			bytes: 2,
			forMarker: 1,
		},
		uint32: {
			bytes: 4,
			forMarker: 2,
		},
		int64: {
			bytes: 8,
			forMarker: 3,
		},
		float: {
			bytes: 4,
			forMarker: 2,
		},

		double: {
			bytes: 8,
			forMarker: 3,
		},
	},
};
