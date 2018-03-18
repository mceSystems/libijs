/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const progress = require("./lib/progress");

/******************************************************************************
 * Exports
 *****************************************************************************/
/**
 *
 *
 * @param {libijs.Device} device
 * @param {libijs.services.InstallationProxy} installationProxy
 * @param {Object} config
 * @returns {JarvisEmitter}
 */
module.exports = function uninstallApp(device, installationProxy, config) {
	// Note that the extra "\n" is for the progress/status bar
	console.log("Uninstalling app...\n");
	return installationProxy.uninstall(config.appid)
		.step(progress.renderStep);
};
