/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const PropertyListService = require("../PropertyListService");

/******************************************************************************
 * Consts
 *****************************************************************************/
const InterfaceOrientation = {
	Unknown:			0,
	Portrait:			1,
	PortraitUpsideDown: 2,
	LandscapeRight:		3,
	LandscapeLeft:		4,
};

/**
 *
 *
 * @class SpringBoardServices
 * @extends {PropertyListService}
 */
class SpringBoardServices extends PropertyListService {
	/**
	 *
	 *
	 * @readonly
	 * @static
	 *
	 * @memberof SpringBoardServices
	 */
	static get InterfaceOrientation() {
		return InterfaceOrientation;
	}

	/**
	 *
	 *
	 * @param {string} formatVersion
	 * @returns {JarvisEmitter}
	 *
	 * @memberof SpringBoardServices
	 */
	getIconState(formatVersion) {
		const request = {
			command: "getIconState",
		};

		if (formatVersion) {
			request.formatVersion = formatVersion;
		}

		return this._writeBinary(request);
	}

	/**
	 *
	 *
	 * @param {Object} state
	 * @returns {JarvisEmitter}
	 *
	 * @memberof SpringBoardServices
	 */
	setIconState(state) {
		return this._writeBinary({
			command: "setIconState",
			iconState: state,
		}, false);
	}

	/**
	 *
	 *
	 * @param {string} bundleId
	 * @returns {JarvisEmitter}
	 *
	 * @memberof SpringBoardServices
	 */
	getIconPNGData(bundleId) {
		const request = {
			command: "getIconPNGData",
			bundleId,
		};

		return this._writeBinary(request)
			.done.middleware((next, response) => {
				next(response ? response.pngData : null);
			});
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof SpringBoardServices
	 */
	getInterfaceOrientation() {
		return this._writeBinary({ command: "getInterfaceOrientation" })
			.done.middleware((next, response) => {
				next(response ? response.interfaceOrientation : null);
			});
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof SpringBoardServices
	 */
	getHomeScreenWallpaperPNGData() {
		return this._writeBinary({ command: "getHomeScreenWallpaperPNGData" })
			.done.middleware((next, response) => {
				next(response ? response.pngData : null);
			});
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = SpringBoardServices;
