/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const commandline = require("./commandline");
const printObject = require("../lib/printObject");

const libijs = require("../../");
const meaco = require("meaco");

const DiagnosticsRelay = libijs.services.DiagnosticsRelay;

/******************************************************************************
 * Consts
 *****************************************************************************/
const printObjectMiddleware = function printObjectMiddleware(next, result) {
	if (!result) {
		return next(false);
	}

	printObject(result);
	next(true);
};

const commandHandlers = {
	diagnostics(diagnosticsRelay, options) {
		return diagnosticsRelay.requestDiagnostics(options.type)
			.done.middleware(printObjectMiddleware);
	},
	mobilegestalt(diagnosticsRelay, options) {
		return diagnosticsRelay.queryMobilegestalt(options.keys)
			.done.middleware((next, result) => {
				if (!result || !result.MobileGestalt) {
					return next(false);
				}

				printObject(result.MobileGestalt);
				next(true);
			});
	},
	ioreg(diagnosticsRelay, options) {
		return diagnosticsRelay.queryIORegistry(options.plane, options.entry, options.class)
			.done.middleware(printObjectMiddleware);
	},
	shutdown(diagnosticsRelay, options) {
		return diagnosticsRelay.shutdown(DiagnosticsRelay.ActionFlags.WaitForDisconnect)
			.done.middleware((next, result) => {
				console.log(result ? "Shutting down the device" : "Failed to shut down the device");
				next(result);
			});
	},
	restart(diagnosticsRelay, options) {
		return diagnosticsRelay.restart(DiagnosticsRelay.ActionFlags.WaitForDisconnect)
			.done.middleware((next, result) => {
				console.log(result ? "Restarting the device" : "Failed to restart the device");
				next(result);
			});
	},
	sleep(diagnosticsRelay, options) {
		return diagnosticsRelay.sleep()
			.done.middleware((next, result) => {
				console.log(result ? "Putting the device into sleep mode" : "Failed to put the device into sleep mode");
				next(result);
			});
	},
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

		// Connect to the diagnostics_relay service on the device
		const diagnosticsRelay = yield libijs.services.getService(device, "diagnostics_relay");
		if (!diagnosticsRelay) {
			console.log("Failed to connect to the diagnostics_relay");
			return null;
		}

		// Handle the user command
		const command = commandline._[0];
		return yield commandHandlers[command](diagnosticsRelay, commandline);
	})
	.error((err) => {
		console.log(err);
		process.exit(1);
	})
	.done((result) => {
		process.exit(result ? 0 : 1);
	});
});
