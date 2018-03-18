/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const UsbmuxdConnection = require("./UsbmuxdConnection");
const UsbmuxdDeviceConnection = require("./UsbmuxdDeviceConnection");
const UsbmuxdProtocolClient = require("./UsbmuxdProtocolClient");
const conf = require("./conf");

// External Modules
const net = require("net");

/**
 *
 *
 * @class UsbmuxdClient
 */
class UsbmuxdClient {
	/**
	 * Creates an instance of UsbmuxdClient.
	 * @param {Object} [options={}]
	 * @memberof UsbmuxdClient
	 */
	constructor(options = {}) {
		this.__conf = Object.assign({}, conf, options);
	}

	/**
	 *
	 *
	 * @returns
	 */
	getDeviceList() {
		return this.__doWithProtocolClient("getDeviceList");
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 */
	listen() {
		const protocolClient = this.__createProtocolClient();
		return protocolClient.listen()
			.done.middleware((next, result) => {
				next(result ? protocolClient : null);
			});
	}

	/**
	 *
	 *
	 * @param {Object} deviceInfo
	 * @param {number} port
	 * @returns {JarvisEmitter}
	 */
	connect(deviceInfo, port) {
		const connection = new UsbmuxdDeviceConnection(this.__conf, deviceInfo.SerialNumber, net.connect(this.__conf.usbmuxdAddress));
		const protocolClient = new UsbmuxdProtocolClient(connection);

		return protocolClient.connect(deviceInfo, port)
			.done.middleware((next, result) => {
				next(result ? connection : null);
			});
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 */
	readBuid() {
		return this.__doWithProtocolClient("readBuid");
	}

	/**
	 *
	 *
	 * @param {string} recordId
	 * @returns {JarvisEmitter}
	 */
	readPairRecord(recordId) {
		return this.__doWithProtocolClient("readPairRecord", recordId);
	}

	/**
	 *
	 *
	 * @param {string} recordId
	 * @param {Object} pairRecord
	 * @returns {JarvisEmitter}
	 */
	savePairRecord(recordId, pairRecord) {
		return this.__doWithProtocolClient("savePairRecord", recordId, pairRecord);
	}

	/**
	 *
	 *
	 * @param {string} recordId
	 * @returns {JarvisEmitter}
	 */
	deletePairRecord(recordId) {
		return this.__doWithProtocolClient("deletePairRecord", recordId);
	}

	/**
	 *
	 *
	 * @readonly
	 * @memberof UsbmuxdClient
	 */
	get DeviceEvent() {
		return UsbmuxdProtocolClient.DeviceEvent;
	}

	/**
	 *
	 *
	 * @returns {UsbmuxdProtocolClient}
	 */
	__createProtocolClient() {
		return new UsbmuxdProtocolClient(new UsbmuxdConnection(net.connect(this.__conf.usbmuxdAddress)));
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 */
	__doWithProtocolClient(action, ...args) {
		const client = this.__createProtocolClient();

		return client[action](...args).always(() => {
			client.close();
		});
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = UsbmuxdClient;
