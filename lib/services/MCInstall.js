/**
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const PropertyListService = require("../PropertyListService");
const plist = require("../plist");

// mce Modules
const meaco = require("meaco");

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
		return meaco(function* doRemoveProfile(reject) {
			// Get the profile info (and make sure it exists)
			const profileList = yield this.getProfileList();
			const profile = profileList[profileIdentifier];
			if (!profile) {
				return reject(`Profile ${profileIdentifier} is not installed`);
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

			const response = yield this._writeXml(request, true);
			return this.__checkResponseAndNotifyError(request, response, reject);
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
			debug(`"${request.Request}" request has failed with status: ${JSON.stringify(response)}`);
			errorCallback(response.Status);
			return false;
		}

		return true;
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = MCInstall;
