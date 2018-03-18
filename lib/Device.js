/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/**
 *
 *
 * @class Device
 */
class Device {
	/**
	 * Creates an instance of Device.
	 *
	 * @param {UsbmuxdClient} usbmuxdClient
	 * @param {Object} deviceInfo
	 *
	 * @memberof Device
	 */
	constructor(usbmuxdClient, deviceInfo) {
		this.__deviceInfo = deviceInfo;
		this.__usbmuxdClient = usbmuxdClient;
	}

	/**
	 *
	 *
	 * @param {number} port
	 * @returns
	 *
	 * @memberof Device
	 */
	connect(port) {
		return this.__usbmuxdClient.connect(this.__deviceInfo, port);
	}

	/**
	 *
	 *
	 * @readonly
	 *
	 * @memberof Device
	 */
	get udid() { return this.__deviceInfo.SerialNumber; }

	/**
	 *
	 *
	 * @readonly
	 *
	 * @memberof Device
	 */
	get id() { return this.__deviceInfo.DeviceID; }

	/**
	 *
	 *
	 * @readonly
	 *
	 * @memberof Device
	 */
	get usbmuxdClient() { return this.__usbmuxdClient; }
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = Device;
