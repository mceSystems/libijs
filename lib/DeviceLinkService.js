/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const PropertyListService = require("./PropertyListService");

// mce Modules
const meaco = require("meaco");

// External Modules
const debug = require("debug")("libijs:DeviceLinkService");

/**
 *
 *
 * @class DeviceLinkService
 * @extends {PropertyListService}
 */
class DeviceLinkService extends PropertyListService {
	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof DeviceLinkService
	 */
	close() {
		return this._disconnect();
	}

	/**
	 *
	 *
	 * @param {number} majorVersion
	 * @param {number} minorVersion
	 * @returns {JarvisEmitter}
	 *
	 * @memberof DeviceLinkService
	 */
	_versionExchange(majorVersion, minorVersion) {
		return meaco(function* doVersionExchange() {
			// Get a DLMessageVersionExchange message from the service
			const [, deviceMajorVersion, deviceMinorVersion] = yield this._readMessage("DLMessageVersionExchange");
			if (!deviceMajorVersion) {
				debug("Couldn't receive a valid initial message (DLMessageVersionExchange) from the service");
				return false;
			}

			// Verify the major and minor version are supported
			if ((deviceMajorVersion > majorVersion) ||
				((deviceMajorVersion === majorVersion) && (deviceMinorVersion > minorVersion))) {
				debug(`Service version mismatch: device version is ${deviceMajorVersion}.${deviceMinorVersion}, we support up tp ${majorVersion}.${minorVersion}`);
				return false;
			}

			// Tell the device the version is OK
			const versionOKMessage = ["DLMessageVersionExchange", "DLVersionsOk", majorVersion];
			if (!(yield this._writeRequestVerified(versionOKMessage, "DLMessageDeviceReady"))) {
				debug("Failed to send DLVersionsOk message");
				return false;
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {string} [message=null]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof DeviceLinkService
	 */
	_disconnect(message = null) {
		return this._writeMessage(["DLMessageDisconnect", message || "___EmptyParameterString___"]);
	}

	/**
	 *
	 *
	 * @param {string} message
	 * @returns {JarvisEmitter}
	 *
	 * @memberof DeviceLinkService
	 */
	_writePing(message) {
		return this._writeMessage(["DLMessagePing", message]);
	}

	/**
	 *
	 *
	 * @param {Object} message
	 * @returns {JarvisEmitter}
	 *
	 * @memberof DeviceLinkService
	 */
	_writeProcessMessage(message) {
		return this._writeMessage(["DLMessageProcessMessage", message]);
	}

	/**
	 *
	 *
	 * @param {any[]} message
	 * @returns {JarvisEmitter}
	 *
	 * @memberof DeviceLinkService
	 */
	_writeMessage(message) {
		return this._writeBinary(message, false);
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof DeviceLinkService
	 */
	_readProcessMessage() {
		return this._readMessage("DLMessageProcessMessage")
			.done.middleware((next, message) => {
				if (message.length !== 2) {
					debug(`Got an invalid DLMessageProcessMessage message: ${JSON.stringify(message)}`);
					return next(null);
				}

				next(message[1]);
			});
	}

	/**
	 *
	 *
	 * @param {string} [expectedMessage=null]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof DeviceLinkService
	 */
	_readMessage(expectedMessage = null) {
		return this._read()
			.done.middleware((next, message) => {
				if (!expectedMessage) {
					next(message);
					return;
				}

				if (message && (message[0] === expectedMessage)) {
					next(message);
				} else {
					debug(`Got an invalid message: expected a ${expectedMessage} message, received ${JSON.stringify(message)}`);
					next(null);
				}
			});
	}

	/**
	 *
	 *
	 * @param {string} request
	 * @param {string} expectedMessage
	 * @returns {JarvisEmitter}
	 *
	 * @memberof DeviceLinkService
	 */
	_writeRequestVerified(request, expectedMessage) {
		return this._writeBinary(request)
			.done.middleware((next, message) => {
				// If we're expecting a specific message - verify we've got it
				if (expectedMessage === message[0]) {
					next(message);
				} else {
					debug(`Got an invalid message in response to ${JSON.stringify(request)}: expected a ${expectedMessage} message, received ${JSON.stringify(message)}`);
					next(null);
				}
			});
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = DeviceLinkService;
