/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const BinaryProtocolClient = require("./lib/BinaryProtocolClient");

// mce Modules
const JarvisEmitter = require("jarvis-emitter");

/**
 *
 *
 * @class Service
 * @extends {BinaryProtocolClient}
 */
class Service extends BinaryProtocolClient {
	/**
	 * Creates an instance of Service.
	 *
	 * @param {UsbmuxdDeviceConnection} connection
	 * @param {number} headerSize
	 * @param {BinaryProtocolClient.Mode} [mode=BinaryProtocolClient.Mode.RequestResponse]
	 *
	 * @memberof Service
	 */
	constructor(connection, headerSize, mode = BinaryProtocolClient.Mode.RequestResponse) {
		super(connection, headerSize, mode);
	}

	/**
	 *
	 *
	 * @param {boolean} [enableSSL=false]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof Service
	 */
	init(enableSSL = false) {
		if (enableSSL) {
			return this._connection.enableSSL();
		}

		return new JarvisEmitter().callDone(true);
	}

	/**
	 *
	 *
	 * @readonly
	 *
	 * @memberof Service
	 */
	get sslEnabled() {
		return this._connection.sslEnabled;
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = Service;
