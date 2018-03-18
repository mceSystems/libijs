/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const protocol = require("./protocol");

// mce Modules
const meaco = require("meaco");

// External Modules
const ref = require("ref");
const debug = require("debug")("libijs:services:afc");

/**
 * A wrapper for a single AFC file
 *
 * @class File
 */
class File {
	/**
	 * Creates an instance of File.
	 *
	 * @param {AFC} service
	 * @param {string} path
	 * @param {number} handle
	 *
	 * @memberof File
	 */
	constructor(service, path, handle) {
		this.__service = service;
		this.__path = path;
		this.__handle = handle;
		this.__handleBuffer = ref.alloc(ref.types.uint64, this.__handle);
	}

	/**
	 *
	 *
	 * @readonly
	 *
	 * @memberof File
	 */
	get path() { return this.__path; }

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof File
	 */
	close() {
		return this.__service._dispatchPacket(protocol.operations.FILE_CLOSE, this.__handleBuffer);
	}

	/**
	 *
	 *
	 * @param {number} size
	 * @returns {JarvisEmitter}
	 *
	 * @memberof File
	 */
	read(size) {
		const data = new protocol.operationsData.Read({ size, handle: this.__handle });
		return this.__service._dispatchPacket(protocol.operations.FILE_READ, data.ref());
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof File
	 */
	readAll() {
		return meaco(function* doReadAll() {
			const fileInfo = yield this.getInfo();
			if (!fileInfo) {
				debug("readAll: Failed to get file info");
				return null;
			}
			const fileSize = parseInt(fileInfo.st_size, 10);

			return yield this.read(fileSize);
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {Buffer} buffer
	 * @returns {JarvisEmitter}
	 *
	 * @memberof File
	 */
	write(buffer) {
		return this.__service._dispatchPacket(protocol.operations.FILE_WRITE, this.__handleBuffer, buffer);
	}

	/**
	 * TODO: When tested, this doesn't really seem to lock the file (was able to write and
	 * delete it while locked with "exclusive").
	 *
	 * @param {AFC.LockFlags} operation
	 * @returns {JarvisEmitter}
	 *
	 * @memberof File
	 */
	lock(operation) {
		const data = new protocol.operationsData.Lock({ operation, handle: this.__handle });
		return this.__service._dispatchPacket(protocol.operations.FILE_LOCK, data.ref());
	}

	/**
	 *
	 *
	 * @param {number} offset
	 * @param {AFC.SeekOrigin} whence
	 * @returns
	 *
	 * @memberof File
	 */
	seek(offset, whence) {
		const data = new protocol.operationsData.Seek({ offset, whence, handle: this.__handle });
		return this.__service._dispatchPacket(protocol.operations.FILE_SEEK, data.ref());
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof File
	 */
	tell() {
		return this.__service._dispatchPacket(protocol.operations.FILE_TELL, this.__handleBuffer)
			.done.middleware((next, result) => {
				next(result ? result.readUInt64LE(0) : 0);
			});
	}

	/**
	 *
	 *
	 * @param {number} newSize
	 * @returns {JarvisEmitter}
	 *
	 * @memberof File
	 */
	truncate(newSize) {
		const data = new protocol.operationsData.Truncate({ newSize, handle: this.__handle });
		return this.__service._dispatchPacket(protocol.operations.FILE_SET_SIZE, data.ref());
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof File
	 */
	getInfo() {
		return this.__service.getFileInfo(this.__path);
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = File;
