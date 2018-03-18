/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
// mce Modules
const JarvisEmitter = require("jarvis-emitter");

/**
 *
 *
 * @class UsbmuxdConnection
 * @extends {JarvisEmitter}
 */
class UsbmuxdConnection extends JarvisEmitter {
	/**
	 * Creates an instance of UsbmuxdConnection.
	 *
	 * @param {net.Socket} socket
	 * @param {boolean} [autoRead=false]
	 *
	 * @memberof UsbmuxdConnection
	 */
	constructor(socket, autoRead = false) {
		super();

		this.extend([
			JarvisEmitter
				.interfaceProperty()
				.name("readable")
				.role(JarvisEmitter.role.event)
				.description("Triggered when data is available on the underlying socket")
				.build(),
			JarvisEmitter
				.interfaceProperty()
				.name("data")
				.role(JarvisEmitter.role.event)
				.description("Triggered when data is available on the underlying socket")
				.build(),
			JarvisEmitter
				.interfaceProperty()
				.name("connectionClose")
				.role(JarvisEmitter.role.event)
				.description("Triggered when the underlying socket is closed")
				.build(),
		]);

		this.__autoRead = autoRead;

		this._handleSocketReadable = this._handleSocketReadable.bind(this);
		this._socket = socket;
		this._socket.setKeepAlive(true);
		this._socket.pause();
		this._socket.on("readable", this._handleSocketReadable);
		this._socket.on("error", (err) => {
			this.callError(err);
		});
		this._socket.on("close", () => {
			this.callConnectionClose();
		});
	}

	/**
	 *
	 *
	 * @memberof UsbmuxdConnection
	 */
	close() {
		this._socket.end();
	}

	/**
	 * Returns the auto-read mode of the connection
	 *
	 * @memberof UsbmuxdConnection
	 */
	get autoRead() {
		return this.__autoRead;
	}

	/**
	 * Sets the auto-read mode of the connection
	 *
	 * @param {boolean} [autoRead=false]
	 *
	 * @memberof UsbmuxdConnection
	 */
	set autoRead(autoRead) {
		this.__autoRead = autoRead;
	}

	/**
	 *
	 *
	 * @param {number} size
	 * @returns
	 *
	 * @memberof UsbmuxdConnection
	 */
	read(size) {
		return this._socket.read(size);
	}

	/**
	 *
	 *
	 * @param {Buffer} data
	 *
	 * @memberof UsbmuxdConnection
	 */
	write(data) {
		this._socket.write(data);
	}

	/**
	 *
	 *
	 * @memberof UsbmuxdConnection
	 */
	_handleSocketReadable() {
		if (this.__autoRead) {
			let chunk = null;
			while (null !== (chunk = this._socket.read())) {
				this.callData(chunk);
			}
		} else {
			this.callReadable();
		}
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = UsbmuxdConnection;
