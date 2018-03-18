/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
// mce Modules
const JarvisEmitter = require("jarvis-emitter");

/******************************************************************************
 * Consts
 *****************************************************************************/
const DataMode = {
	RequestResponse: 1,
	Events: 2,
	RawStream: 3,
};


/**
 * A base class for implementing binary protocols over stream based connections (sockets)
 *
 * @class BinaryProtocolClient
 * @extends {JarvisEmitter}
 */
class BinaryProtocolClient extends JarvisEmitter {
	/**
	 * Creates an instance of BinaryProtocolClient.
	 *
	 * @param {UsbmuxConnection} connection
	 * @param {number} headerSize
	 * @param {DataMode} [mode=DataMode.RequestResponse]
	 *
	 * @memberof BinaryProtocolClient
	 */
	constructor(connection, headerSize, mode = DataMode.RequestResponse) {
		super();

		this.extend([
			JarvisEmitter
				.interfaceProperty()
				.name("data")
				.role(JarvisEmitter.role.event)
				.description("Triggered when a packet was received from the service (only when mode is set to Events)")
				.build(),
			JarvisEmitter
				.interfaceProperty()
				.name("connectionClose")
				.role(JarvisEmitter.role.event)
				.description("Triggered when a the client connection is closed")
				.build(),
		]);

		this._pendingRequests = [];
		this._nextHeader = null;

		this.__headerSize = headerSize;
		this.__mode = mode;
		this.__nextDataSize = 0;

		this.__hasPendingData = false;

		// Initialize the underlying connection
		this.__connection = connection;
		this.__connection.autoRead = false;
		this.__handleReadable = this.__handleReadable.bind(this);
		this.__connection.readable(this.__handleReadable);
		this.__connection.error((err) => {
			this.callError(err);
		});
		this.__connection.connectionClose(() => {
			this.callConnectionClose();
		});
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof BinaryProtocolClient
	 */
	init() {
		return new JarvisEmitter().callDone(true);
	}

	/**
	 *
	 *
	 * @param {boolean} [closeConnection=true]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof BinaryProtocolClient
	 */
	close(closeConnection = true) {
		if (!this.__connection) {
			return new JarvisEmitter().callDone(true);
		}

		if (closeConnection) {
			this.__connection.close();
		} else {
			this.__connection.offReadable(this.__handleReadable);
		}
		this.__connection = null;

		return new JarvisEmitter().callDone(true);
	}

	/**
	 *
	 *
	 * @memberof BinaryProtocolClient
	 */
	get mode() {
		return this.__mode;
	}

	/**
	 *
	 * @param {DataMode} newMode
	 *
	 * @memberof BinaryProtocolClient
	 */
	set mode(newMode) {
		this.__mode = newMode;
	}

	/**
	 *
	 *
	 * @readonly
	 * @static
	 *
	 * @memberof BinaryProtocolClient
	 */
	static get Mode() { return DataMode; }

	/**
	 * Returns the underlying UsbmuxConnection connection
	 *
	 * @readonly
	 *
	 * @memberof BinaryProtocolClient
	 */
	get _connection() { return this.__connection; }

	/**
	 *
	 *
	 * @param {any} data
	 * @param {boolean} isRaw
	 * @param {boolean} waitForResponse
	 * @returns {JarvisEmitter}
	 *
	 * @memberof BinaryProtocolClient
	 */
	_write(data, isRaw, waitForResponse) {
		if (!isRaw) {
			const header = Buffer.alloc(this.__headerSize);
			this._buildHeader(header, data);
			this.__connection.write(header);
		}

		// Write the data, which might be a buffer or an array of buffers (chunk)
		data = this._buildData(data);
		if (Array.isArray(data)) {
			for (const chunk of data) {
				this.__connection.write(chunk);
			}
		} else {
			this.__connection.write(data);
		}

		const pendingRequest = {
			promise: new JarvisEmitter(),
			isRaw,
		};
		this._handleNewPendingRequest(pendingRequest, waitForResponse);

		return pendingRequest.promise;
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof BinaryProtocolClient
	 */
	_read() {
		const pendingRequest = {
			promise: new JarvisEmitter(),
			isRaw: false,
		};

		this._handleNewPendingRequest(pendingRequest, true);
		return pendingRequest.promise;
	}

	/**
	 *
	 *
	 * @param {number} size
	 * @returns {JarvisEmitter}
	 *
	 * @memberof BinaryProtocolClient
	 */
	_readRaw(size) {
		const pendingRequest = {
			promise: new JarvisEmitter(),
			isRaw: true,
			size,
		};

		this._handleNewPendingRequest(pendingRequest, true);
		return pendingRequest.promise;
	}

	/**
	 *
	 *
	 * @param {Buffer} header
	 *
	 * @memberof BinaryProtocolClient
	 */
	_parseHeader(header) {
		throw new Error("Not Implemented");
	}

	/**
	 *
	 *
	 * @param {Buffer} header
	 *
	 * @memberof BinaryProtocolClient
	 */
	_getDataSizeFromHeader(header) {
		throw new Error("Not Implemented");
	}

	/**
	 *
	 *
	 * @param {any} data
	 *
	 * @memberof BinaryProtocolClient
	 */
	_buildHeader(data) {
		throw new Error("Not Implemented");
	}

	/**
	 *
	 *
	 * @param {Buffer} data
	 * @returns {any}
	 *
	 * @memberof BinaryProtocolClient
	 */
	_parseData(data) {
		return data;
	}

	/**
	 *
	 *
	 * @param {any} data
	 * @returns {any}
	 *
	 * @memberof BinaryProtocolClient
	 */
	_buildData(data) {
		return data;
	}

	/**
	 *
	 *
	 * @param {Object} request
	 * @param {boolean} waitForResponse
	 *
	 * @memberof BinaryProtocolClient
	 */
	_handleNewPendingRequest(request, waitForResponse) {
		/* When we're on "request-response" mode, we'll complete the promise
		 * when have a response. Other wise will complete it now (since we've sent it). */
		if (waitForResponse && (this.__mode === DataMode.RequestResponse)) {
			this._pendingRequests.push(request);

			// Maybe some data has arrived before a user's read request
			if (this.__hasPendingData) {
				this.__handleReadable();
			}
		} else {
			request.promise.callDone(true);
		}
	}

	/**
	 *
	 *
	 * @param {any} data
	 *
	 * @memberof BinaryProtocolClient
	 */
	_completeNextPendingRequest(data) {
		const currentRequest = this._pendingRequests.shift();
		currentRequest.promise.callDone(data);
	}

	/**
	 *
	 *
	 * @memberof BinaryProtocolClient
	 */
	__handleReadable() {
		let shouldContinue = true;
		while (shouldContinue && this.__connection) {
			if (this.__isCurrentRequestRaw()) {
				shouldContinue = this.__handleRawRead();
			} else {
				shouldContinue = this.__handleProtocolRead();
			}
		}
	}

	/**
	 *
	 *
	 * @returns {boolean}
	 *
	 * @memberof BinaryProtocolClient
	 */
	__isCurrentRequestRaw() {
		if (this.__mode === DataMode.RequestResponse) {
			return (this._pendingRequests.length && this._pendingRequests[0].isRaw);
		}

		return this.__mode === DataMode.RawStream;
	}

	/**
	 *
	 *
	 * @returns {boolean}
	 *
	 * @memberof BinaryProtocolClient
	 */
	__handleProtocolRead() {
		this.__hasPendingData = true;

		// Make sure we have at least one read request waiting (if we're in request-response mode)
		if ((DataMode.RequestResponse === this.__mode) && (0 === this._pendingRequests.length)) {
			return false;
		}

		// If needed - try to read the next of the next header
		if (0 === this.__nextDataSize) {
			const nextHeaderBuffer = this.__connection.read(this.__headerSize);
			if (!nextHeaderBuffer) {
				return false;
			}

			this._nextHeader = this._parseHeader(nextHeaderBuffer);
			this.__nextDataSize = this._getDataSizeFromHeader(this._nextHeader);
		}

		/* Try to read the next packet data, if we have data to read. this._getDataSizeFromHeader might return a zero,
		 * so in that case we'll pass on "null" data to our subclasses and let them handle it.
		 * Note: __hasPendingData must be reset before calling __handleNewData, as the user
		 * might create new requests from the pending promise callback (_handleNewPendingRequest checks __hasPendingData). */
		if (0 !== this.__nextDataSize) {
			const dataBuffer = this.__connection.read(this.__nextDataSize);
			if (!dataBuffer) {
				return false;
			}

			// We've read all the data we know about
			this.__hasPendingData = false;

			// Parse the new packet data and pass it to our listeners
			this.__handleNewData(this._parseData(dataBuffer, this._nextHeader));

			// Reset the packet size "tracking", indicating we're moving on to the next packet
			this.__nextDataSize = 0;
		} else {
			// We don't have any pending data to read
			this.__hasPendingData = false;

			this.__handleNewData(null);
		}

		// Reset our state so we'll be ready to move on to the next packet
		this._nextHeader = null;

		return true;
	}

	/**
	 *
	 *
	 * @param {any} data
	 *
	 * @memberof BinaryProtocolClient
	 */
	__handleNewData(data) {
		// Pass the new packet data to our listeners
		if (this.__mode === DataMode.RequestResponse) {
			this._completeNextPendingRequest(data);
		} else {
			this.callData(data);
		}
	}

	/**
	 *
	 *
	 * @returns {boolean}
	 *
	 * @memberof BinaryProtocolClient
	 */
	__handleRawRead() {
		if (this.__mode === DataMode.RawStream) {
			const data = this.__connection.read();
			if (!data) {
				return false;
			}

			this.callData(data);
			return true;
		}

		this.__hasPendingData = true;

		// Make sure we have at least one read request waiting
		if (0 === this._pendingRequests.length) {
			return false;
		}

		if (0 === this.__nextDataSize) {
			this.__nextDataSize = this._pendingRequests[0].size;
		}

		const data = this.__connection.read(this.__nextDataSize);
		if (!data) {
			return false;
		}
		this.__hasPendingData = false;

		this._completeNextPendingRequest(data);

		// Reset the packet size "tracking", indicating we're on to the next packet
		this.__nextDataSize = 0;

		return true;
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = BinaryProtocolClient;
