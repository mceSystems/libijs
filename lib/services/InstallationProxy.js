/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const PropertyListService = require("../PropertyListService");

// mce Modules
const JarvisEmitter = require("jarvis-emitter");
const meaco = require("meaco");

// External Modules
const debug = require("debug")("libijs:services:installation_proxy");

/******************************************************************************
 * Consts
 *****************************************************************************/
const GET_PATH_FOR_BUNDLE_ID_CLIENT_OPTIONS = {
	ReturnAttributes: ["CFBundleIdentifier", "CFBundleExecutable", "Path"],
};

/**
 *
 *
 * @class InstallationProxy
 * @extends {PropertyListService}
 */
class InstallationProxy extends PropertyListService {
	/**
	 *
	 *
	 * @param {Object} clientOptions
	 * @returns {JarvisEmitter}
	 *
	 * @memberof InstallationProxy
	 */
	browse(clientOptions) {
		const request = {
			Command: "Browse",
		};
		if (clientOptions) {
			request.ClientOptions = clientOptions;
		}

		const apps = [];
		return this.__doRequestWithSteps(request, (promise, response) => {
			if ("BrowsingApplications" === response.Status) {
				for (const app of response.CurrentList) {
					promise.callStep(app);
					apps.push(app);
				}
			}
		}).done.middleware((next, result) => {
			next(result ? apps : null);
		});
	}

	/**
	 *
	 *
	 * @param {string[]} [appIds=null]
	 * @param {Object} [clientOptions=null]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof InstallationProxy
	 */
	lookup(appIds = null, clientOptions = null) {
		// Build the request
		const request = {
			Command: "Lookup",
		};

		if (appIds) {
			if (!clientOptions) {
				clientOptions = {};
			}

			clientOptions.BundleIDs = appIds;
		}

		if (clientOptions) {
			request.ClientOptions = clientOptions;
		}

		return this.__doRequestWithSingleResponse(request)
			.done.middleware((next, result) => {
				next(result ? result.LookupResult : null);
			});
	}

	/**
	 *
	 *
	 * @param {string} packagePath
	 * @param {Object} [clientOptions=null]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof InstallationProxy
	 */
	install(packagePath, clientOptions = null) {
		// Build the request
		const request = {
			Command: "Install",
			PackagePath: packagePath,
		};
		if (clientOptions) {
			request.ClientOptions = clientOptions;
		}

		return this.__doRequestWithSteps(request, (promise, response) => {
			promise.callStep(response);
		});
	}

	/**
	 *
	 *
	 * @param {string} packagePath
	 * @param {Object} [clientOptions=null]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof InstallationProxy
	 */
	upgrade(packagePath, clientOptions = null) {
		// Build the request
		const request = {
			Command: "Upgrade",
			PackagePath: packagePath,
		};
		if (clientOptions) {
			request.ClientOptions = clientOptions;
		}

		return this.__doRequestWithSteps(request, (promise, response) => {
			promise.callStep(response);
		});
	}

	/**
	 *
	 *
	 * @param {string} appId
	 * @param {Object} [clientOptions=null]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof InstallationProxy
	 */
	uninstall(appId, clientOptions = null) {
		// Build the request
		const request = {
			Command: "Uninstall",
			ApplicationIdentifier: appId,
		};
		if (clientOptions) {
			request.ClientOptions = clientOptions;
		}

		return this.__doRequestWithSteps(request, (promise, response) => {
			promise.callStep(response);
		});
	}

	/**
	 *
	 *
	 * @param {any} capabilities
	 * @param {any} [clientOptions=null]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof InstallationProxy
	 */
	checkCapabilitiesMatch(capabilities, clientOptions = null) {
		// Build the request
		const request = {
			Command: "CheckCapabilitiesMatch",
		};
		if (clientOptions) {
			request.ClientOptions = clientOptions;
		}
		if (capabilities) {
			request.Capabilities = capabilities;
		}

		return this.__doRequestWithSingleResponse(request)
			.done.middleware((next, result) => {
				next(result ? result.LookupResult : null);
			});
	}

	/**
	 *
	 *
	 * @param {string} appId
	 * @returns {JarvisEmitter}
	 *
	 * @memberof InstallationProxy
	 */
	getPathForBundleIdentifier(appId) {
		return this.lookup([appId], GET_PATH_FOR_BUNDLE_ID_CLIENT_OPTIONS)
			.done.middleware((next, result) => {
				if (!result) {
					return next(null);
				}

				const app = result[0];
				if (!app || !app.Path || !app.CFBundleExecutable) {
					debug(`Got an invalid response for lookup on app ${appId}: ${JSON.stringify(result)}`);
					return next(null);
				}

				next(`${app.Path}/${app.CFBundleExecutable}`);
			});
	}

	/**
	 * @callback requestCallback
	 * @param {JarvisEmitter} promise
	 * @param {Object} response
	 *
	 */

	/**
	 *
	 *
	 * @param {Object} request
	 * @param {requestCallback} [responseCallback=null]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof InstallationProxy
	 */
	__doRequestWithSteps(request, responseCallback = null) {
		const promise = meaco(function* doRequestWithSteps() {
			// Send the command (request)
			if (!(yield this._writeXml(request, false))) {
				debug(`Failed to send "${request.Command}" command`);
				return false;
			}

			let completed = false;
			while (!completed) {
				// Read the next plist (response)
				const response = yield this._read();
				if (!response) {
					debug(`Failed to get a response for "${request.Command}" command`);
					return false;
				}
				if (!this.__validateResponse(request, response)) {
					return false;
				}

				if ("Complete" === response.Status) {
					completed = true;
				}

				responseCallback(promise, response);
			}

			return true;
		}.bind(this));

		return promise.extend([
			JarvisEmitter
                .interfaceProperty()
                .name("step")
                .role(JarvisEmitter.role.event)
                .description("Triggered for each part (step) of the result (app, installtion status, etc.)")
                .build(),
		]);
	}

	/**
	 *
	 *
	 * @param {Object} request
	 * @returns {JarvisEmitter}
	 *
	 * @memberof InstallationProxy
	 */
	__doRequestWithSingleResponse(request) {
		return meaco(function* doRequestWithSingleResponse() {
			if (!(yield this._writeXml(request, false))) {
				debug(`Failed to send "${request.Command}" command`);
				return null;
			}

			// Read and parse the result (we expect the lookup to complete in one response)
			const result = yield this._read();
			if (!result) {
				debug(`Failed to get a response for "${request.Command}" command`);
				return false;
			}
			if (!this.__validateResponse(request, result)) {
				return null;
			}
			if ("Complete" !== result.Status) {
				debug(`Got an invalid status response for command "${request.Command}": ${result.Status}`);
				return null;
			}

			return result;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {Object} request
	 * @param {Object} response
	 * @returns {boolean}
	 *
	 * @memberof InstallationProxy
	 */
	__validateResponse(request, response) {
		if (response.Error) {
			const code = (undefined !== response.ErrorDetail) ? `0x${response.ErrorDetail.toString(16)}` : "unknown";
			debug(`Command "${request.Command}" has failed: ${response.Error}, code: ${code}, description: ${response.ErrorDescription || "unknown"}`);
			return false;
		}
		if (!response.Status) {
			debug(`Got an invalid response for command "${request.Command}" (missing status): ${JSON.stringify(response)}`);
			return false;
		}

		return true;
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = InstallationProxy;
