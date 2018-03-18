/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const commandline = require("./commandline");
const libijs = require("../../");

// mce Modules
const meaco = require("meaco");

const commandHandlers = {
	list: require("./commands/list"),
	install: require("./commands/install"),
	uninstall: require("./commands/uninstall"),
};

/******************************************************************************
 * Entry Point
 *****************************************************************************/
const deviceManager = libijs.createClient().deviceManager;
deviceManager.ready(() => {
	meaco(function* main() {
		// Get the device (either by the user supplied udid, or the first device)
		const device = deviceManager.getDevice(commandline.udid);
		if (!device) {
			console.log("Couldn't find device");
			return false;
		}

		// Connect to the installation_proxy service on the device
		const installationProxy = yield libijs.services.getService(device, "installation_proxy");
		if (!installationProxy) {
			console.log("Failed to connect to the installation_proxy");
			return null;
		}

		// Handle the user command
		const command = commandline._[0];
		return (yield commandHandlers[command](device, installationProxy, commandline));
	})
	.error((err) => {
		console.log(err);
		process.exit(1);
	})
	.done((result) => {
		process.exit(result ? 0 : 1);
	});
});
