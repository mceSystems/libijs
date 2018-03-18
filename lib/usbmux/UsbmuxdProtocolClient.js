/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const BinaryProtocolClient = require("../lib/BinaryProtocolClient");
const protocol = require("./protocol");
const htons = require("../lib/endianness").htons;
const plist = require("../plist");

// mce Modules
const JarvisEmitter = require("jarvis-emitter");

/******************************************************************************
 * Consts
 *****************************************************************************/
// Must match usbmuxd's "MessageType" field on device event plists
const deviceEvents = {
	Attached: 0,
	Detached: 1,
	Paired:   2,
};

const messages = protocol.messages.plist.types;

/**
 *
 *
 * @class UsbmuxdProtocolClient
 * @extends {BinaryProtocolClient}
 */
class UsbmuxdProtocolClient extends BinaryProtocolClient {
	/**
	 * Creates an instance of UsbmuxdProtocolClient.
	 *
	 * @param {UsbmuxdConnection} connection
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	constructor(connection) {
		super(connection, protocol.headerSize);

		this.extend([
			JarvisEmitter
                .interfaceProperty()
                .name("device")
                .role(JarvisEmitter.role.event)
                .description("Triggered on a device event, when listening to device events")
                .build(),
		]);

		this.__tag = 0;
	}

	/**
	 *
	 *
	 * @readonly
	 * @static
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	static get DeviceEvent() {
		return deviceEvents;
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	getDeviceList() {
		return this.__writeMessage(messages.listDevices)
			.done.middleware((next, deviceList) => {
				next(deviceList ? deviceList.map(n => n.Properties) : null);
			});
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	listen() {
		return this.__writeMessage(messages.listen)
			.done.middleware((next, result) => {
				if (!result) {
					return next(false);
				}

				this.data((deviceEvent) => {
					// Note that "Properties" only exists on "Attach" messages
					this.callDevice(deviceEvents[deviceEvent.MessageType],
									deviceEvent.DeviceID,
									deviceEvent.Properties);
				});

				// Switch our connection to message polling mode
				this.mode = BinaryProtocolClient.Mode.Events;

				next(true);
			});
	}

	/**
	 *
	 *
	 * @param {Object} deviceInfo
	 * @param {number} port
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	connect(deviceInfo, port) {
		const requestFields = {
			DeviceID: deviceInfo.DeviceID,
			PortNumber: htons(port),
		};

		return this.__writeMessage(messages.connect, requestFields)
			.done.middleware((next, result) => {
				if (!result) {
					return next(null);
				}

				/* "Detach" from the underlying connection, as it's now a tunnel the the
				 * requested device/port */
				const connection = this._connection;
				this.close(false);

				next(connection);
			});
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	readBuid() {
		return this.__writeMessage(messages.readBuid);
	}

	/**
	 *
	 *
	 * @param {string} recordId
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	readPairRecord(recordId) {
		return this.__writeMessage(messages.readPairRecord, { PairRecordID: recordId });
	}

	/**
	 *
	 *
	 * @param {string} recordId
	 * @param {Object} pairRecordData
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	savePairRecord(recordId, pairRecordData) {
		if (typeof pairRecordData !== "string") {
			pairRecordData = plist.createXml(pairRecordData);
		}

		const requestFields = {
			PairRecordID: recordId,
			PairRecordData: pairRecordData,
		};

		return this.__writeMessage(messages.readPairRecord, requestFields);
	}

	/**
	 *
	 *
	 * @param {string} recordId
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	deletePairRecord(recordId) {
		return this.__writeMessage(messages.deletePairRecord, { PairRecordID: recordId });
	}

	/**
	 *
	 *
	 * @param {Buffer} header
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	_parseHeader(header) {
		return header.readUInt32LE(0) - protocol.headerSize;
	}

	/**
	 *
	 *
	 * @param {Buffer} header
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	_getDataSizeFromHeader(header) {
		return header;
	}

	/**
	 *
	 *
	 * @param {Buffer} header
	 * @param {Buffer} [data=null]
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	_buildHeader(header, data = null) {
		const dataSize = data ? data.length : 0;

		header.writeUInt32LE(protocol.headerSize + dataSize, 0);
		header.writeUInt32LE(protocol.version, 4);
		header.writeUInt32LE(protocol.messages.plist.code, 8);
		header.writeUInt32LE(this.__tag, 12);

		this.__tag++;
	}

	/**
	 *
	 *
	 * @param {Buffer} data
	 * @returns {any}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	_parseData(data) {
		return plist.parse(data);
	}

	/**
	 *
	 *
	 * @param {string} type
	 * @param {Object} additionalFields
	 * @returns {Object}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	__createMessage(type, additionalFields) {
		const message = {
			BundleID: 			 protocol.messages.plist.bundleId,
			ClientVersionString: protocol.messages.plist.clientVersion,
			MessageType: 		 type,
			ProgName:  			 protocol.messages.plist.programName,
			kLibUSBMuxVersion: 	 protocol.messages.plist.version,
		};

		return additionalFields ? Object.assign(message, additionalFields) : message;
	}

	/**
	 *
	 *
	 * @param {Object} messageType
	 * @param {Object} [additionalRequestFields=null]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdProtocolClient
	 */
	__writeMessage(messageType, additionalRequestFields = null) {
		const requestMessage = this.__createMessage(messageType.request, additionalRequestFields);

		return this._write(plist.createXml(requestMessage), false, true)
			.done.middleware((next, response) => {
				if (!response) {
					return next(null);
				}

				next(messageType.responseParser(response));
			});
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = UsbmuxdProtocolClient;
