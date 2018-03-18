/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const PropertyListService = require("../PropertyListService");
const plist = require("../plist");

// mce Modules
const meaco = require("meaco");
const JarvisEmitter = require("jarvis-emitter");

// External Modules
const debug = require("debug")("libijs:services:MCInstall");

/**
 *
 *
 * @class MCInstall
 * @extends {PropertyListService}
 */
class MCInstall extends PropertyListService {
	/**
	 *
	 *
	 * @param {Object} profile
	 * @returns {JarvisEmitter}
	 * @memberof MCInstall
	 */
	installProfile(profile) {
		// Note that Payload should be a data item, not a string
		const request = {
			RequestType: "InstallProfile",
			Payload: plist.createXml(profile, false),
		};

		const promise = this._writeXml(request, true);
		return promise.done.middleware((next, response) => {
			if (this.__checkResponseAndNotifyError(request, response, promise.callError.bind(promise))) {
				next(true);
			}
		});
	}

	/**
	 * Based on pymobiledevice's mobile_config.py
	 *
	 * @param {string} profileIdentifier
	 * @returns {JarvisEmitter}
	 * @memberof MCInstall
	 */
	removeProfile(profileIdentifier) {
		return meaco(function* doRemoveProfile() {
			// Get the profile info (and make sure it exists)
			const profileList = yield this.getProfileList();
			const profile = profileList[profileIdentifier];
			if (!profile) {
				return yield new JarvisEmitter().callError(`Profile ${profileIdentifier} is not installed`);
			}

			const payload = {
				PayloadType: "Configuration",
				PayloadIdentifier: profileIdentifier,
				PayloadUUID: profile.PayloadUUID,
				PayloadVersion: profile.PayloadVersion,
			};

			// Note that ProfileIdentifier should be a data item, not a string
			const request = {
				RequestType: "RemoveProfile",
				ProfileIdentifier: plist.createXml(payload, false),
			};

			const emitter = this._writeXml(request, true);
			return yield emitter.done.middleware((next, response) => {
				if (this.__checkResponseAndNotifyError(request, response, emitter.callError.bind(emitter))) {
					next(true);
				}
			});
		}.bind(this));
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 * @memberof MCInstall
	 */
	getProfileList() {
		const request = {
			RequestType: "GetProfileList",
		};

		const promise = this._writeXml(request, true);
		return promise.done.middleware((next, response) => {
			if (this.__checkResponseAndNotifyError(request, response, promise.callError.bind(promise))) {
				if (response.ProfileMetadata) {
					next(response.ProfileMetadata);
				} else {
					debug(`Got an invalid response for GetProfileList request (missing ProfileMetadata): ${JSON.stringify(response)}`);
					promise.callError("Invalid response");
				}
			}
		});
	}

	/**
	 *
	 *
	 * @param {Object} request
	 * @param {Object} response
	 * @param {JarvisEmitter} promise
	 * @returns {boolean}
	 * @memberof MCInstall
	 */
	__checkResponseAndNotifyError(request, response, errorCallback) {
		if (!response.Status) {
			debug(`Got an invalid response for "${request.RequestType}" request (missing status): ${JSON.stringify(response)}`);
			errorCallback("Invalid response");
			return false;
		}

		if ("Acknowledged" !== response.Status) {
			debug(`"${request.RequestType}" request has failed with status: ${JSON.stringify(response)}`);
			errorCallback(`Failed with status '${response.Status}': ${JSON.stringify(response.ErrorChain, null, 4)}`);
			return false;
		}

		return true;
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = MCInstall;
