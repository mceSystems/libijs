/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const UsbmuxdConnection = require("./UsbmuxdConnection");
const UsbmuxdProtocolClient = require("./UsbmuxdProtocolClient");

// mce Modules
const JarvisEmitter = require("jarvis-emitter");

// External Modules
const tls = require("tls");
const net = require("net");

/**
 *
 *
 * @class UsbmuxdDeviceConnection
 * @extends {UsbmuxdConnection}
 */
class UsbmuxdDeviceConnection extends UsbmuxdConnection {
	/**
	 * Creates an instance of UsbmuxdDeviceConnection.
	 *
	 * @param {string} udid
	 * @param {net.Socket} socket
	 * @param {boolean} [autoRead=false]
	 *
	 * @memberof UsbmuxdDeviceConnection
	 */
	constructor(conf, udid, socket, autoRead = false) {
		super(socket, autoRead);
		this.__udid = udid;
		this.__isSSL = false;
		this.__conf = conf;
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdDeviceConnection
	 */
	enableSSL() {
		const promise = new JarvisEmitter();

		/* Get the device's pairing record, needed for the ssl's certificate and key.
		 * We can't use the helper function from index.js since index.js uses our class. */
		const usbmuxClient = new UsbmuxdProtocolClient(new UsbmuxdConnection(net.connect(this.__conf.usbmuxdAddress)));
		usbmuxClient.readPairRecord(this.__udid)
			.done(((pairRecord) => {
				this._socket.removeListener("readable", this._handleSocketReadable);

				// The device is expecting the (client) certificate from it's pairing record
				const socketOptions = {
					secureContext: tls.createSecureContext({
						secureProtocol: "TLSv1_method",
						cert: pairRecord.RootCertificate,
						key: pairRecord.RootPrivateKey,
					}),
				};

				this._socket = new tls.TLSSocket(this._socket, socketOptions);
				this._socket.on("readable", this._handleSocketReadable);

				this.__isSSL = true;
				usbmuxClient.close().pipe(promise);
			}).bind(this));

		return promise;
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof UsbmuxdDeviceConnection
	 */
	disableSSL() {
		const promise = new JarvisEmitter();

		// TODO: Is it possible to unwrap the underlying socket?
		this.__isSSL = false;
		promise.callDone(true);

		return promise;
	}

	/**
	 *
	 *
	 * @readonly
	 *
	 * @memberof UsbmuxdDeviceConnection
	 */
	get isSSL() { return this.__isSSL; }

	/**
	 *
	 *
	 * @readonly
	 *
	 * @memberof UsbmuxdDeviceConnection
	 */
	get udid() { return this.__udid; }
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = UsbmuxdDeviceConnection;
