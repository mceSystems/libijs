/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const DeviceLinkService = require("../DeviceLinkService");

// mce Modules
const meaco = require("meaco");

// External Modules
const debug = require("debug")("libijs:services:mobilebackup2");

/******************************************************************************
 * Consts
 *****************************************************************************/
const MOBILEBACKUP2_VERSION = {
	major: 300,
	minor: 1,
};

/**
 *
 *
 * @class MobileBackup2
 * @extends {DeviceLinkService}
 */
class MobileBackup2 extends DeviceLinkService {
	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof MobileBackup2
	 */
	init() {
		return this._versionExchange(MOBILEBACKUP2_VERSION.major, MOBILEBACKUP2_VERSION.minor);
	}

	/**
	 *
	 *
	 * @param {string} message
	 * @param {Object} [options={}]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof MobileBackup2
	 */
	writeMessage(message, options = {}) {
		if (message) {
			options.MessageName = message;
		}

		return this._writeProcessMessage(options);
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof MobileBackup2
	 */
	readMessage() {
		return this._readMessage();
	}

	/**
	 *
	 *
	 * @param {Buffer} buffer
	 *
	 * @memberof MobileBackup2
	 */
	writeRaw(buffer) {
		this._writeRaw(buffer);
	}

	/**
	 *
	 *
	 * @param {number} size
	 * @returns {JarvisEmitter}
	 *
	 * @memberof MobileBackup2
	 */
	readRaw(size) {
		return this._readRaw(size);
	}

	/**
	 *
	 *
	 * @param {number[]} localVersions
	 * @returns {JarvisEmitter}
	 *
	 * @memberof MobileBackup2
	 */
	versionExchange(localVersions) {
		return meaco(function* doVersionExchange() {
			if (!(yield this.writeMessage("Hello", { SupportedProtocolVersions: localVersions }))) {
				debug("Failed to send 'Hello' message");
				return 0.0;
			}

			const response = yield this._readProcessMessage();
			if (!response || ("Response" !== response.MessageName)) {
				debug(`Invalid response to Hello' message: ${response}`);
				return 0.0;
			}

			// Check if we've received an error
			if (response.ErrorCode) {
				debug(`Got and error code in response to 'Hello' message: ${response.ErrorCode}`);
				return 0.0;
			}

			debug(`Service protocol version: ${response.ProtocolVersion}`);
			return response.ProtocolVersion;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {string} request
	 * @param {string} targetIdentifier
	 * @param {string} sourceIdentifier
	 * @param {Object} options
	 * @returns {JarvisEmitter}
	 *
	 * @memberof MobileBackup2
	 */
	sendRequest(request, targetIdentifier, sourceIdentifier, options) {
		const requestParams = {
			TargetIdentifier: targetIdentifier,
		};

		if (sourceIdentifier) {
			requestParams.SourceIdentifier = sourceIdentifier;
		}

		if (options) {
			requestParams.Options = options;
			if ("Unback" === request) {
				if (options.Password) {
					requestParams.Password = options.Password;
				}
			} else if ("EnableCloudBackup" === request) {
				if (options.CloudBackupState) {
					requestParams.CloudBackupState = options.CloudBackupState;
				}
			}
		}

		return this.writeMessage(request, requestParams);
	}

	/**
	 *
	 *
	 * @param {number} statusCode
	 * @param {string} status1
	 * @param {Object} status2
	 * @returns {JarvisEmitter}
	 *
	 * @memberof MobileBackup2
	 */
	sendStatusResponse(statusCode, status1, status2) {
		return this._writeMessage(["DLMessageStatusResponse",
								  statusCode,
								  status1 || "___EmptyParameterString___",
								  status2 || "___EmptyParameterString___"]);
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = MobileBackup2;
