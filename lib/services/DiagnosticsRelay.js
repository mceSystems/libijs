/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const PropertyListService = require("../PropertyListService");
const debug = require("debug")("libijs:services:DiagnosticsRelay");

/******************************************************************************
 * Consts
 *****************************************************************************/
const DiagnosticsRequestTypes = {
	All: "All",
	WiFi: "WiFi",
	GasGauge: "GasGauge",
	NAND: "NAND",
};

const ActionFlags = {
	WaitForDisconnect: 1,
	DisplayPass: 2,
	DisplayFail: 4,
};

/**
 * 
 * 
 * @class DiagnosticsRelay
 * @extends {PropertyListService}
 */
class DiagnosticsRelay extends PropertyListService {

	/**
	 * 
	 * 
	 * @param {string} [requestType=DiagnosticsRequestTypes.All]
	 * @returns {JarvisEmitter}
	 * @memberof DiagnosticsRelay
	 */
	requestDiagnostics(requestType = DiagnosticsRequestTypes.All) {
		return this.__performRequest(requestType, null, "Diagnostics");
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 * @memberof DiagnosticsRelay
	 */
	sleep() {
		return this.__performRequest("Sleep");
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 * @memberof DiagnosticsRelay
	 */
	goodbye() {
		return this.__performRequest("Goodbye");
	}

	/**
	 *
	 *
	 * @param {number} flags
	 * @returns {JarvisEmitter}
	 * @memberof DiagnosticsRelay
	 */
	restart(flags) {
		return this.__performRequest("Restart", flags);
	}

	/**
	 *
	 *
	 * @param {number} flags
	 * @returns {JarvisEmitter}
	 * @memberof DiagnosticsRelay
	 */
	shutdown(flags) {
		return this.__performRequest("Shutdown", flags);
	}

	/**
	 *
	 *
	 * @param {string[]} keys
	 * @returns {JarvisEmitter}
	 * @memberof DiagnosticsRelay
	 */
	queryMobilegestalt(keys) {
		const request = {
			Request: "MobileGestalt",
			MobileGestaltKeys: keys,
		};

		return this.__performRequestWithCustomRequest(request, null, "Diagnostics");
	}

	/**
	 * Note that it seems that caller should provide either plane, entry name
	 * or class name, but not more than one. It seems if more than one is present
	 * in the request, mobile_diagnostics_relay will use the first one it encounters,
	 * in the following order: plane -> entry name -> entry class.
	 *
	 * @param {any} [plane=null]
	 * @param {any} [name=null]
	 * @param {any} [className=null]
	 * @returns {JarvisEmitter}
	 * @memberof DiagnosticsRelay
	 */
	queryIORegistry(plane = null, entryName = null, className = null) {
		const request = {
			Request: "IORegistry",
		};
		if (plane) {
			request.CurrentPlane = plane;
		}
		if (entryName) {
			request.EntryName = entryName;
		}
		if (className) {
			request.EntryClass = className;
		}

		return this.__performRequestWithCustomRequest(request, null, "Diagnostics");
	}

	/**
	 *
	 *
	 * @readonly
	 * @static
	 * @memberof DiagnosticsRelay
	 */
	static get DiagnosticsRequestTypes() { return DiagnosticsRequestTypes; }

	/**
	 *
	 *
	 * @readonly
	 * @static
	 * @memberof DiagnosticsRelay
	 */
	static get ActionFlags() { return ActionFlags; }

	/**
	 *
	 *
	 * @param {string} requestType
	 * @param {number} [flags=null]
	 * @param {string} [responseField=null]
	 * @returns {JarvisEmitter}
	 * @memberof DiagnosticsRelay
	 */
	__performRequest(requestType, flags = null, responseField = null) {
		const request = {
			Request: requestType,
		};

		return this.__performRequestWithCustomRequest(request, flags, responseField);
	}

	/**
	 *
	 *
	 * @param {Object} request
	 * @param {number} [flags=null]
	 * @param {string} [responseField=null]
	 * @returns {JarvisEmitter}
	 * @memberof DiagnosticsRelay
	 */
	__performRequestWithCustomRequest(request, flags = null, responseField = null) {
		if (flags) {
			if (flags & ActionFlags.WaitForDisconnect) {
				request.WaitForDisconnect = true;
			}
			if (flags & ActionFlags.DisplayPass) {
				request.DisplayPass = true;
			}
			if (flags & ActionFlags.DisplayFail) {
				request.DisplayFail = true;
			}
		}

		return this._writeXml(request, true)
			.done.middleware((next, response) => {
				// For requests which don't need a specific response field, we'll just return true\false
				if (this.__checkResponse(request, response)) {
					next(responseField ? response[responseField] : true);
				} else {
					// TODO: Call "error"
					next(responseField ? null : false);
				}
			});
	}

	/**
	 *
	 *
	 * @param {Object} request
	 * @param {Object} response
	 * @returns {boolean}
	 * @memberof DiagnosticsRelay
	 */
	__checkResponse(request, response) {
		if (!response.Status) {
			debug(`Got an invalid response for "${request.Request}" request (missing status): ${JSON.stringify(response)}`);
			return false;
		}

		if ("Success" !== response.Status) {
			if (("Failure" === response.Status) || ("UnknownRequest" === response.Status)) {
				debug(`"${request.Request}" request has failed with status: ${JSON.stringify(response)}`);
			} else {
				debug(`"${request.Request}" request has returned an unknown status: ${JSON.stringify(response)}`);
			}

			return false;
		}

		return true;
	}
}

module.exports = DiagnosticsRelay;
