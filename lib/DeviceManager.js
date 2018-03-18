/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const Device = require("./Device");

// mce Modules
const JarvisEmitter = require("jarvis-emitter");

// External Modules
const debug = require("debug")("libijs:DeviceManager");

/**
 *
 *
 * @class DeviceManager
 * @extends {JarvisEmitter}
 */
class DeviceManager extends JarvisEmitter {
	/**
	 * Creates an instance of DeviceManager.
	 *
	 * @param {UsbmuxdClient} usbmuxdClient
	 * @memberof DeviceManager
	 */
	constructor(usbmuxdClient) {
		super();

		this.extend([
			JarvisEmitter
				.interfaceProperty()
				.name("ready")
				.role(JarvisEmitter.role.event)
				.sticky(true)
				.description("Triggered when the DeviceManager has finished initializing")
				.build(),
			JarvisEmitter
				.interfaceProperty()
				.name("attached")
				.role(JarvisEmitter.role.event)
				.description("Triggered when a new device was attached")
				.build(),
			JarvisEmitter
				.interfaceProperty()
				.name("detached")
				.role(JarvisEmitter.role.event)
				.description("Triggered when a device was disconnected")
				.build(),
			JarvisEmitter
				.interfaceProperty()
				.name("paired")
				.role(JarvisEmitter.role.event)
				.description("Triggered when a device was paired with usbmuxd")
				.build(),
			JarvisEmitter
				.interfaceProperty()
				.name("connectionClose")
				.role(JarvisEmitter.role.event)
				.description("Triggered when the usbmuxd connection is closed")
				.build(),
		]);
		this.__usbmuxdClient = usbmuxdClient;
		this.__handleDeviceEvent = this.__handleDeviceEvent.bind(this);

		// Build our initial device list
		this.__devices = [];
		this.__usbmuxdClient.getDeviceList()
			.done((devices) => {
				this.__devices = devices.map((dev) => { return new Device(this.__usbmuxdClient, dev); });
				this.callReady();

				this.__usbmuxdClient.listen()
					.done((listener) => {
						this._listener = listener;
						this._listener.device(this.__handleDeviceEvent);
						this._listener.connectionClose(() => {
							this.callConnectionClose();
						});
					});
			});
	}

	/**
	 *
	 *
	 * @param {string} [udid=null]
	 * @returns {(Device|null)}
	 *
	 * @memberof DeviceManager
	 */
	getDevice(udid = null) {
		if (0 === this.__devices.length) {
			return null;
		}

		if (!udid) {
			return this.__devices[0];
		}

		return this.__devices.find((dev) => { return udid === dev.udid; });
	}

	/**
	 *
	 *
	 * @readonly
	 *
	 * @memberof DeviceManager
	 */
	get devices() { return this.__devices; }

	/**
	 *
	 *
	 * @param {UsbmuxdClient.DeviceEvent} event
	 * @param {string} deviceId
	 * @param {Object} properties
	 *
	 * @memberof DeviceManager
	 */
	__handleDeviceEvent(event, deviceId, properties) {
		let device = null;
		switch (event) {
			// A new device was attached
			case this.__usbmuxdClient.DeviceEvent.Attached:
				if (!this.__devices.find((dev) => { return deviceId === dev.id; })) {
					device = new Device(this.__usbmuxdClient, properties);
					this.__devices.push(device);
					this.callAttached(device);
				}
				break;

			// A device was detached
			case this.__usbmuxdClient.DeviceEvent.Detached:
				const removedDeviceIdx = this.__devices.findIndex((dev) => { return deviceId === dev.id; });
				if (-1 !== removedDeviceIdx) {
					device = this.__devices[removedDeviceIdx];
					this.__devices.splice(removedDeviceIdx, 1);
					this.callDetached(device);
				}
				break;

			// A device was paired with usbmuxd
			case this.__usbmuxdClient.DeviceEvent.Paired:
				device = this.__devices.find((dev) => { return deviceId === dev.id; });
				this.callPaired(device);
				break;

			default:
				debug(`Got an unknown event ${event} for device ${deviceId}, with properties: ${JSON.stringify(properties, null, 4)}`);
				break;
		}
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = DeviceManager;
