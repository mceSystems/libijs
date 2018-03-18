/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const PropertyListService = require("../PropertyListService");
const plist = require("../plist");

// External Modules
const debug = require("debug")("libijs:services:MobileActivation");

/**
 *
 *
 * @class MobileActivation
 * @extends {PropertyListService}
 */
class MobileActivation extends PropertyListService {
	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 * @memberof MobileActivation
	 */
	getActivationState() {
		return this.__performCommand("GetActivationStateRequest", null, "Value");
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 * @memberof MobileActivation
	 */
	createActivationSessionInfo() {
		return this.__performCommand("CreateTunnel1SessionInfoRequest", null, "Value");
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 * @memberof MobileActivation
	 */
	createActivationInfo() {
		return this.__performCommand("CreateActivationInfoRequest", null, "Value");
	}

	/**
	 *
	 *
	 * @param {Object} handshakeResponse
	 * @returns {JarvisEmitter}
	 * @memberof MobileActivation
	 */
	createActivationInfoWithSession(handshakeResponse) {
		return this.__performCommand("CreateTunnel1ActivationInfoRequest",
									 plist.createXml(handshakeResponse, false),
									 "Value");
	}

	/**
	 *
	 *
	 * @param {Object} activationRecord
	 * @returns {JarvisEmitter}
	 * @memberof MobileActivation
	 */
	activate(activationRecord) {
		return this.__performCommand("HandleActivationInfoRequest", activationRecord);
	}

	/**
	 *
	 *
	 * @param {Object} activationRecord
	 * @returns {JarvisEmitter}
	 * @memberof MobileActivation
	 */
	activateWithSession(activationRecord) {
		return this.__performCommand("HandleActivationInfoWithSessionRequest", plist.createXml(activationRecord, false));
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 * @memberof MobileActivation
	 */
	deactivate() {
		return this.__performCommand("DeactivateRequest", null);
	}

	/**
	 *
	 *
	 * @param {string} command
	 * @param {any} value
	 * @param {string} responseField
	 * @returns {JarvisEmitter}
	 * @memberof MobileActivation
	 */
	__performCommand(command, value, responseField) {
		const serviceCommand = {
			Command: command,
		};
		if (value) {
			serviceCommand.Value = value;
		}

		const promise = this._writeXml(serviceCommand, true);
		return promise.done.middleware((next, response) => {
			if (!response) {
				debug(`Got and empty response for "${command}" command`);
				return promise.callError("Empty response");
			}
			if (response.Error) {
				debug(`Command "${command}" has failed with an error: ${response.Error}`);
				return promise.callError(response.Error);
			}

			if (responseField) {
				const responseFieldValue = response[responseField];
				if (!responseFieldValue) {
					debug(`Missing filed ${responseField} in "${command}" command response: ${JSON.stringify(response, null, 4)}`);
					return promise.callError("Invalid response"); 
				}

				return next(responseFieldValue);
			}

			next(response);
		});
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = MobileActivation;
