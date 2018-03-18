/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Exports
 *****************************************************************************/
if ("win32" === process.platform) {
	module.exports = {
		usbmuxdAddress: { port: 27015, host: "localhost" },
	};
} else {
	module.exports = {
		usbmuxdAddress: { path: "/var/run/usbmuxd" },
	};
}
