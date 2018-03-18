/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const plist = require("../plist");

/**
 *
 *
 * @param {Object} response
 * @returns
 */
const resultResponseParser = function resultResponseParser(response) {
	return (("Result" === response.MessageType) && (0 === response.Number));
};

/**
 *
 *
 * @param {string} member
 * @param {boolean} [isPlist=false]
 * @returns
 */
const createResponseMemberParser = function createResponseMemberParser(member, isPlist = false) {
	return (response) => {
		if (undefined === response[member]) {
			return null;
		}

		return isPlist ? plist.parse(response[member]) : response[member];
	};
};

/******************************************************************************
 * Exports
 *****************************************************************************/
// Define the details of usbmuxd's protocol v1, using only plist messages
module.exports = {
	version: 1,
	headerSize: 16,
	messages: {
		plist: {
			code: 8,
			bundleId: "org.libijs.usbmux",
			clientVersion: "libijs usbmux built for js",
			programName: "node-libijs-usbmux",
			version: 3,
			types: {
				listDevices: {
					request: "ListDevices",
					responseParser: createResponseMemberParser("DeviceList"),
				},
				listen: {
					request: "Listen",
					responseParser: resultResponseParser,
				},
				connect: {
					request: "Connect",
					responseParser: resultResponseParser,
				},
				readBuid: {
					request: "ReadBUID",
					responseParser: createResponseMemberParser("BUID"),
				},
				readPairRecord: {
					request: "ReadPairRecord",
					responseParser: createResponseMemberParser("PairRecordData", true),
				},
				savePairRecord: {
					request: "SavePairRecord",
					responseParser: resultResponseParser,
				},
				deletePairRecord: {
					request: "DeletePairRecord",
					responseParser: resultResponseParser,
				},
			},
		},
	},
};
