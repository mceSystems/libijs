/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const libijs = require("../../");

// Define and parse our command line
const args = require("yargs")
	.usage("Relay syslog of a connected device")
	.option("udid", {
		description: "target specific device by its 40-digit device UDID",
		required: false,
		alias: "u",
		type: "string",
		requiresArg: true,
	})
	.strict()
	.help()
	.argv;

/**
 *
 *
 * @class DeviceSysLogMonitor
 */
class DeviceSysLogMonitor {
	/**
	 * Creates an instance of DeviceSysLogMonitor.
	 *
	 * @param {string} udid
	 *
	 * @memberof DeviceSysLogMonitor
	 */
	constructor(udid) {
		this.__udid = udid;
		this.__service = null;
		this.__deviceManager = libijs.createClient().deviceManager;

		// Setup device monitoring
		this.__handleDeviceAttach = this.__handleDeviceAttach.bind(this);
		this.__handleDeviceDettach = this.__handleDeviceDettach.bind(this);
		this.__deviceManager.attached(this.__handleDeviceAttach);
		this.__deviceManager.detached(this.__handleDeviceDettach);

		this.__deviceManager.ready(() => {
			// If a device is present - start logging
			const device = this.__deviceManager.getDevice(this.__udid);
			if (device) {
				this.__udid = device.udid;
				this.__startLogging(device);
			} else {
				console.log(`Waiting for ${this.__udid || "any device"}...`);
			}
		});
	}

	/**
	 *
	 *
	 * @param {libijs.Device} device
	 *
	 * @memberof DeviceSysLogMonitor
	 */
	__handleDeviceAttach(device) {
		if (this.__udid) {
			if (this.__udid === device.udid) {
				this.__startLogging(device);
			}
		} else {
			this.__udid = device.udid;
			this.__startLogging(device);
		}
	}

	/**
	 *
	 *
	 * @param {libijs.Device} device
	 *
	 * @memberof DeviceSysLogMonitor
	 */
	__handleDeviceDettach(device) {
		if (this.__udid === device.udid) {
			console.log("\n[disconnected]");
			this.__service.close()
				.done(() => {
					this.__service = null;
				});
		}
	}

	/**
	 *
	 *
	 * @param {libijs.Device} device
	 *
	 * @memberof DeviceSysLogMonitor
	 */
	__startLogging(device) {
		// Connect to the syslog_relay service
		libijs.services.getService(device, "syslog_relay")
			.done((service) => {
				this.__service = service;
				if (service) {
					this.__service.data((data) => { process.stdout.write(data); });
					console.log("\n[connected]");
				} else {
					console.log("Failed to connect to the syslog_relay service");
				}
			});
	}
}

/******************************************************************************
 * Entry Point
 *****************************************************************************/
const deviceSysLogMonitor = new DeviceSysLogMonitor(args.udid);
