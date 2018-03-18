/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const Service = require("../../Service");
const protocol = require("./protocol");
const File = require("./File");
const fileStreams = require("./streams");
const walk = require("../../lib/walk");
const afcWalk = require("./walk");

// mce Modules
const meaco = require("meaco");
const JarvisEmitter = require("jarvis-emitter");

// External Modules
const ref = require("ref");
const fs = require("fs-extra");
const debug = require("debug")("libijs:services:afc");

/**
 *
 *
 * @class AFC
 * @extends {Service}
 */
class AFC extends Service {
	/**
	 * Creates an instance of AFC.
	 *
	 * @param {UsbmuxdDeviceConnection} connection
	 *
	 * @memberof AFC
	 */
	constructor(connection) {
		super(connection, protocol.header.Struct.size);

		this.__packetNumber = 0;

		this._pendingRequests = new Map();
	}

	/**
	 *
	 *
	 * @readonly
	 * @static
	 *
	 * @memberof AFC
	 */
	static get FileMode() {
		return protocol.fileMode;
	}

	/**
	 *
	 *
	 * @readonly
	 * @static
	 * @memberof AFC
	 */
	static get LinkType() {
		return protocol.linkType;
	}

	/**
	 *
	 *
	 * @readonly
	 * @static
	 *
	 * @memberof AFC
	 */
	static get LockFlags() {
		return protocol.lockFlags;
	}

	/**
	 *
	 *
	 * @readonly
	 * @static
	 *
	 * @memberof AFC
	 */
	static get SeekOrigin() {
		return protocol.seekOrigin;
	}

	/**
	 *
	 *
	 * @param {string} path
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	readDirectory(path) {
		return this._dispatchPacket(protocol.operations.READ_DIR, ref.allocCString(path))
			.done.middleware((next, result) => {
				next(this.__parseStringsBuffer(result));
			});
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	getDeviceInfo() {
		return this._dispatchPacket(protocol.operations.GET_DEVINFO)
			.done.middleware((next, result) => {
				if (!result) {
					debug("getDeviceInfo: Failed to retrieve the device info");
					return next(null);
				}
				next(this.__parseObjectBuffer(result));
			});
	}

	/**
	 *
	 *
	 * @param {string} path
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	removePath(path) {
		return this._dispatchPacket(protocol.operations.REMOVE_PATH, ref.allocCString(path));
	}

	/**
	 *
	 *
	 * @param {string} from
	 * @param {string} to
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	renamePath(from, to) {
		// A RENAME_PATH packet data contains two null terminated strings: the "from" and "to"
		const data = Buffer.alloc((from.length + 1) + (to.length + 1));
		data.writeCString(from);
		data.writeCString(to, from.length + 1);

		return this._dispatchPacket(protocol.operations.RENAME_PATH, data);
	}

	/**
	 *
	 *
	 * @param {string} path
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	makeDirectory(path) {
		return this._dispatchPacket(protocol.operations.MAKE_DIR, ref.allocCString(path));
	}

	/**
	 *
	 *
	 * @param {string} path
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	getFileInfo(path) {
		return this._dispatchPacket(protocol.operations.GET_FILE_INFO, ref.allocCString(path))
			.done.middleware(((next, result) => {
				if (!result) {
					debug(`getFileInfo: Failed to retrieve file info for ${path}`);
					return next(null);
				}
				next(this.__parseObjectBuffer(result));
			}).bind(this));
	}

	/**
	 *
	 *
	 * @param {string} fileName
	 * @param {(protocol.fileMode|string)} mode
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	openFile(fileName, mode) {
		if ("string" === typeof mode) {
			mode = protocol.fileMode[mode];
		}

		// A FILE_OPEN packet data contains a mode (uint64) and the null terminated file name
		const data = Buffer.alloc(ref.types.uint64.size + fileName.length + 1);
		data.writeUInt64LE(mode, 0);
		data.writeCString(fileName, ref.types.uint64.size);

		return this._dispatchPacket(protocol.operations.FILE_OPEN, data)
			.done.middleware((next, result) => {
				if (!result) {
					debug(`openFile: Failed to open ${fileName} (mode ${mode})`);
					return next(null);
				}

				// The response contains a file handle
				const fileHandle = result.readUInt64LE(0);
				next(new File(this, fileName, fileHandle));
			});
	}

	/**
	 *
	 *
	 * @param {string} fileName
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	openFileAsReadableStream(fileName) {
		return meaco(function* doOpenFileAsReadableStream() {
			// Open the file
			const file = yield this.openFile(fileName, protocol.fileMode.r);
			if (!file) {
				debug(`openFileAsReadableStream: Failed to open ${fileName}`);
				return null;
			}

			// Get the file size (needed to determine when to end the stream)
			const fileInfo = yield file.getInfo();
			if (!fileInfo) {
				debug(`openFileAsReadableStream: Failed retrieve file info for ${fileName}`);
				yield file.close();
				return null;
			}
			const fileSize = parseInt(fileInfo.st_size, 10);

			return new fileStreams.AfcReadableFileStream(file, fileSize);
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {string} fileName
	 * @param {string} [mode="w"]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	openFileAsWritableStream(fileName, mode = "w") {
		return this.openFile(fileName, mode)
			.done.middleware((next, file) => {
				if (!file) {
					debug(`openFileAsWritableStream: Failed to open ${fileName}`);
					return next(null);
				}

				next(new fileStreams.AfcWritableFileStream(file));
			});
	}

	/**
	 *
	 *
	 * @param {string} localFilePath
	 * @param {string} remoteFilePath
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	uploadFile(localFilePath, remoteFilePath) {
		const promise = new JarvisEmitter();

		this.openFileAsWritableStream(remoteFilePath)
			.done((remoteFile) => {
				if (!remoteFile) {
					debug(`uploadFile: Failed to open ${remoteFilePath}`);
					promise.callDone(false);
				}

				fs.createReadStream(localFilePath)
					.pipe(remoteFile)
					.on("error", (err) => {
						debug(`uploadFile: Failed reading from ${localFilePath}: ${err.message}`);
						promise.callDone(false);
					})
					.on("finish", () => {
						promise.callDone(true);
					});
			});

		return promise;
	}

	/**
	 * Reads the (entire) contents of a file at a given path.
	 * Should be used only when the stream api can't be used.
	 *
	 * @param {string} fileName
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	readFile(fileName) {
		return meaco(function* doReadFile() {
			// Open the file
			const file = yield this.openFile(fileName, "r");
			if (!file) {
				debug(`readFile: Failed to open ${fileName}`);
				return null;
			}

			const content = yield file.readAll();
			if (!content) {
				debug(`readFile: Failed to read the contents of ${fileName}`);
			}

			yield file.close();
			return content;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {string} localPath
	 * @param {string} remotePath
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	uploadDir(localPath, remotePath) {
		return meaco(function* doUploadDir() {
			yield this.makeDirectory(remotePath);
			yield this.__uploadDirRecursive(localPath, remotePath);
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {string} remotePath
	 * @param {boolean} [directoriesAsItems=false]
	 * @param {boolean} [recursive=false]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	walk(remotePath, directoriesAsItems = false, recursive = false) {
		return afcWalk(this, remotePath, directoriesAsItems, recursive);
	}

	/**
	 *
	 *
	 * @param {string} remotePath
	 * @param {string} localPath
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	downloadFile(remotePath, localPath) {
		const promise = new JarvisEmitter();

		this.openFileAsReadableStream(remotePath)
			.done((remoteFile) => {
				if (!remoteFile) {
					debug(`downloadFile: Failed to open ${remotePath}`);
					promise.callDone(false);
					return;
				}

				const localFile = fs.createWriteStream(localPath);
				remoteFile.pipe(localFile);
				localFile.on("finish", () => {
					promise.callDone(true);
				});
			});

		return promise;
	}

	/**
	 *
	 *
	 * @param {string} remotePath
	 * @param {string} localPath
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	downloadDir(remotePath, localPath) {
		const promise = new JarvisEmitter([
			JarvisEmitter
                .interfaceProperty()
                .name("fileStarted")
                .role(JarvisEmitter.role.event)
                .sticky(true)
				        .description("Triggered a file download was started")
                .build(),
			JarvisEmitter
                .interfaceProperty()
                .name("fileFinished")
                .role(JarvisEmitter.role.event)
                .description("Triggered when a file was successfully downloaded")
                .build(),
		]);

		let pendingFiles = 0;
		let filesDownloaded = 0;
		let doneWalking = false;

		// TODO: error handling
		this.walk(remotePath, true, true)
			.item((item) => {
				// If this is a remote dir - just make sure the matching local dir exists
				if (item.stats.isDirectory) {
					fs.ensureDirSync(`${localPath}/${item.relativeToRoot}`);
					return;
				}

				// This is a file - download it
				pendingFiles++;
				this.openFileAsReadableStream(item.fullPath)
					.done((remoteFile) => {
						if (!remoteFile) {
							debug(`downloadDir: Failed to open ${item.fullPath}`);
							return;
						}

						const localFile = fs.createWriteStream(`${localPath}/${item.relativeToRoot}`);
						remoteFile.pipe(localFile);
						localFile.on("finish", () => {
							promise.callFileFinished(item.relativeToRoot);

							filesDownloaded++;
							pendingFiles--;
							if (doneWalking && (0 === pendingFiles)) {
								promise.callDone(filesDownloaded);
							}
						});
					});

				promise.callFileStarted(item.relativeToRoot);
			})
			.done(() => {
				doneWalking = true;
			});

		return promise;
	}

	/**
	 *
	 *
	 * @param {string} path
	 * @param {number} newSize
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	truncateFile(path, newSize) {
		// A TRUNCATE packet data contains the new size (uint64) and the null terminated file path
		const data = Buffer.alloc(ref.types.uint64.size + (path.length + 1));
		data.writeUInt64LE(newSize, 0);
		data.writeCString(path, ref.types.uint64.size);

		return this._dispatchPacket(protocol.operations.TRUNCATE, data);
	}

	/**
	 *
	 *
	 * @param {any} type
	 * @param {string} target
	 * @param {string} linkName
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	makeLink(type, target, linkName) {
		// A MAKE_LINK packet data contains a link type and two null terminated strings (source and target)
		const data = Buffer.alloc(ref.types.uint64.size + (target.length + 1) + (linkName.length + 1));
		data.writeUInt64LE(type, 0);
		data.writeCString(target, ref.types.uint64.size);
		data.writeCString(linkName, ref.types.uint64.size + (target.length + 1));

		return this._dispatchPacket(protocol.operations.MAKE_LINK, data);
	}

	/**
	 *
	 *
	 * @param {string} path
	 * @param {number} time
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	setFileTime(path, time) {
		// A SET_FILE_MOD_TIME packet data contains the new time (uint64) and the null terminated file path
		const data = Buffer.alloc(ref.types.uint64.size + (path.length + 1));
		data.writeUInt64LE(time, 0);
		data.writeCString(path, ref.types.uint64.size);

		return this._dispatchPacket(protocol.operations.SET_FILE_MOD_TIME, data);
	}

	/**
	 *
	 *
	 * @param {string} path
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	removePathAndContents(path) {
		return this._dispatchPacket(protocol.operations.REMOVE_PATH_AND_CONTENTS, ref.allocCString(path));
	}

	/**
	 *
	 *
	 * @param {Buffer} headerBuffer
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	_parseHeader(headerBuffer) {
		// TODO: Validate the header
		return new protocol.header.Struct(headerBuffer);
	}

	/**
	 *
	 *
	 * @param {protocol.header} header
	 * @returns
	 *
	 * @memberof AFC
	 */
	_getDataSizeFromHeader(header) {
		return header.entireLength - protocol.header.Struct.size;
	}

	/**
	 *
	 *
	 * @param {Buffer} headerBuffer
	 * @param {Object} packet
	 *
	 * @memberof AFC
	 */
	_buildHeader(headerBuffer, packet) {
		this.__packetNumber++;

		const dataSize = packet.data ? packet.data.length : 0;
		const payloadSize = packet.payload ? packet.payload.length : 0;

		const header = new protocol.header.Struct(headerBuffer);
		header.magic 		= protocol.header.magic;
		header.packetNumber = this.__packetNumber;
		header.operation 	= packet.operation;
		header.entireLength = protocol.header.Struct.size + dataSize + payloadSize;
		header.thisLength 	= protocol.header.Struct.size + dataSize;
	}

	/**
	 *
	 *
	 * @param {Buffer} data
	 * @param {protocol.header} header
	 * @returns {Buffer}
	 *
	 * @memberof AFC
	 */
	_parseData(data, header) {
		if (protocol.operations.STATUS === header.operation) {
			// TODO: Let the user know what error we've received
			return protocol.error.success === data.readUInt64LE(0);
		}

		return data;
	}

	/**
	 *
	 *
	 * @param {Object} packet
	 * @returns {Buffer[]}
	 *
	 * @memberof AFC
	 */
	_buildData(packet) {
		const chunks = [];

		if (packet.data) {
			chunks.push(packet.data);
		}
		if (packet.payload) {
			chunks.push(packet.payload);
		}

		return chunks;
	}

	/**
	 *
	 *
	 * @param {Object} request
	 *
	 * @memberof AFC
	 */
	_handleNewPendingRequest(request) {
		this._pendingRequests.set(this.__packetNumber, request);
	}

	/**
	 *
	 *
	 * @param {Buffer} data
	 *
	 * @memberof AFC
	 */
	_completeNextPendingRequest(data) {
		const responsePacketNumber = this._nextHeader.packetNumber;

		const pendingRequest = this._pendingRequests.get(responsePacketNumber);
		pendingRequest.promise.callDone(data);

		this._pendingRequests.delete(responsePacketNumber);
	}

	/**
	 *
	 *
	 * @param {protocol.operations} operation
	 * @param {Buffer} [data=null]
	 * @param {Buffer} [payload=null]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof AFC
	 */
	_dispatchPacket(operation, data = null, payload = null) {
		return this._write({ operation, data, payload }, false, true);
	}

	/**
	 *
	 *
	 * @param {Buffer} buffer
	 * @returns {string[]}
	 *
	 * @memberof AFC
	 */
	__parseStringsBuffer(buffer) {
		const strings = [];

		let offset = 0;
		while (offset < buffer.length) {
			// Parse the current null terminated string
			const currentString = buffer.readCString(offset);
			strings.push(currentString);

			// Move to the next string
			offset += currentString.length + 1;
		}

		return strings;
	}

	/**
	 *
	 *
	 * @param {Buffer} buffer
	 * @returns {Object}
	 *
	 * @memberof AFC
	 */
	__parseObjectBuffer(buffer) {
		const obj = {};

		let offset = 0;
		while (offset < buffer.length) {
			// Parse the current null terminated key name
			const key = buffer.readCString(offset);
			offset += key.length + 1;

			// Parse the current null terminated value
			const value = buffer.readCString(offset);
			offset += value.length + 1;

			obj[key] = value;
		}

		return obj;
	}

	/**
	 *
	 *
	 * @param {string} localPath
	 * @param {string} remotePath
	 * @returns {Object}
	 *
	 * @memberof AFC
	 */
	__uploadDirRecursive(localPath, remotePath) {
		const promise = new JarvisEmitter();

		let doneIterating = false;
		let pendingFiles = 0;

		walk(localPath, true, true)
			.item((item) => {
				const remoteFullPath = `${remotePath}/${item.relativeToRoot}`;

				// If we're at a local directory - create it remotely
				if (item.stats.isDirectory()) {
					// TODO: yield?
					this.makeDirectory(remoteFullPath);
					return;
				}

				// We have a local file - upload it
				pendingFiles++;
				this.uploadFile(item.fullPath, `${remotePath}/${item.relativeToRoot}`)
					.done(() => {
						pendingFiles--;
						if (doneIterating && (0 === pendingFiles)) {
							promise.callDone(true);
						}
					});
			})
			.done(() => {
				doneIterating = true;
				if (0 === pendingFiles) {
					promise.callDone(true);
				}
			});

		return promise;
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = AFC;
