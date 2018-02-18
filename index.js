const { UsbmuxdClient } = require("./lib/usbmux");
const DeviceManager = require("./lib/DeviceManager");
const plist = require("./lib/plist");
const lockdownd = require("./lib/lockdownd");
const services = require("./lib/services");
const appletime = require("./lib/lib/appletime");

module.exports = {
	createClient(options = {}) {
		const { UsbmuxdClientClass = UsbmuxdClient } = options;
        const usbmuxdClient = new UsbmuxdClientClass(options);
		return {
			usbmuxdClient,
			deviceManager: new DeviceManager(usbmuxdClient),
		};
	},

	plist,
	lockdownd,
	services,
	util: {
		appletime,
	},
};
