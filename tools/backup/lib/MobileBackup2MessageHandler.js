/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const walk = require("../../../lib/lib/walk");
const { util: { appletime: { dateToAppleDate } } } = require("../../../");
const protocol = require("./protocol");

// mce Modules
const JarvisEmitter = require("jarvis-emitter");
const meaco = require("meaco");

// External Modules
const ref = require("ref");
const fs = require("fs-extra");
const path = require("path");
const diskusage = require("diskusage");

/******************************************************************************
 * Consts
 *****************************************************************************/
const READ_CHUNK_SIZE = 0xffff;

// TODO: More error codes (libimobiledevice only handle these two)
const ErrorToDeviceErrorMapping = {
	ENOENT: -6,
	EEXIST: -7,
};

/**
 *
 *
 * @class MobileBackup2MessageHandler
 */
class MobileBackup2MessageHandler extends JarvisEmitter {
	/**
	 * Creates an instance of MobileBackup2MessageHandler.
	 *
	 * @param {any} mobilebackup2
	 * @param {string} backupDir
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	constructor(mobilebackup2, backupDir) {
		super();

		this.extend([
			JarvisEmitter
				.interfaceProperty()
				.name("overallProgress")
				.role(JarvisEmitter.role.event)
				.description("Triggered when the overall backup/retore progress has changed")
				.build(),
			JarvisEmitter
				.interfaceProperty()
				.name("step")
				.role(JarvisEmitter.role.event)
				.description("Triggered when the current step of the backup/retore has changed")
				.build(),
			JarvisEmitter
				.interfaceProperty()
				.name("stepProgress")
				.role(JarvisEmitter.role.event)
				.description("Triggered when the progress of the current step of the backup/retore has changed")
				.build(),
		]);

		this.__mobilebackup2 = mobilebackup2;
		this.__backupDir = backupDir;

		// Protocol message handlers
		this.__handlers = {
			DLMessageDownloadFiles:		this.__sendFiles,
			DLMessageUploadFiles:		this.__receiveFiles,
			DLMessageGetFreeDiskSpace:	this.__getFreeDiskSpace,
			DLContentsOfDirectory:		this.__listDirectory,
			DLMessageCreateDirectory:	this.__makeDirecotry,
			DLMessageMoveFiles:			this.__moveFiles,
			DLMessageMoveItems:			this.__moveFiles,
			DLMessageRemoveFiles:		this.__removeFiles,
			DLMessageRemoveItems:		this.__removeFiles,
			DLMessageCopyItem:			this.__copyItem,
			DLMessageProcessMessage:	this.__processMessage,
			DLMessageDisconnect:		this.__disconnect,
		};

		this.__statistics = {
			sentFiles: 0,
			sentSize: 0,
			receivedFiles: 0,
			receivedSize: 0,
		};
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	handleMessages() {
		return meaco(function* doHandleMessages() {
			let shouldContinue = true;
			while (shouldContinue) {
				// Read the next messsage from the mobilebackup2 service
				const [message, ...messageArgs] = yield this.__mobilebackup2.readMessage();
				if (!message) {
					console.log("Failed to receive the next message from the device");
					break;
				}

				// Execute the message using its appropriate handler
				const handler = this.__handlers[message];
				if (handler) {
					shouldContinue = yield handler.apply(this, messageArgs);
				} else {
					console.log("Unknown device message: ", message);
				}
			}

			// TODO: Error handling
			return this.__statistics;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__disconnect() {
		return new JarvisEmitter().callDone(false);
	}

	/**
	 *
	 *
	 * @param {any} message
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__processMessage(message) {
		// TODO
		if (message.ErrorCode) {
			console.log(`DLMessageProcessMessage: ${JSON.stringify(message, null, 4)}`);
		}

		return new JarvisEmitter().callDone(false);
	}

	/**
	 *
	 *
	 * @param {any} files
	 * @param {any} progress
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__sendFiles(files, unknown, progress) {
		const fileCount = files.length;

		this.__updateStep("Sending files", fileCount);
		this.__updateOverallProgress(progress);

		return meaco(function* doSendFiles() {
			let hasErrors = false;
			const errors = {};

			for (const file of files) {
				const [result, err] = yield this.__sendFile(file);
				if (!result) {
					// We collect all errors and send them at the end
					hasErrors = true;
					errors[file] = {
						DLFileErrorString: err.message,
						DLFileErrorCode: this.__errorToDeviceError(err),
					};
				}
			}

			// Send terminating 0 (dword)
			this.__sendDword(0);

			// Send the final status
			let responseSent = false;
			if (!hasErrors) {
				// TODO: status2 should be {} or left null?
				responseSent = yield this.__mobilebackup2.sendStatusResponse(0, null, {});
			} else {
				responseSent = yield this.__mobilebackup2.sendStatusResponse(protocol.unknownMultiDtatus, "Multi status", errors);
			}

			if (!responseSent) {
				console.log("Failed to send response to the device");
				return false;
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {any} file
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__sendFile(file) {
		const promise = new JarvisEmitter();

		// Send the file path
		this.__sendDword(file.length);
		this.__mobilebackup2.writeRaw(file);

		fs.createReadStream(path.join(this.__backupDir, file))
			.on("data", (buffer) => {
				// Each file chunk has a "header", containing a DWORD chunk size and a one byte status (protocol.code.fileData)
				const chunkHeaderBuffer = Buffer.alloc(ref.types.uint32.size + ref.types.uint8.size);
				chunkHeaderBuffer.writeUInt32BE(buffer.length + ref.types.uint8.size, 0);
				chunkHeaderBuffer.writeUInt8(protocol.code.fileData, ref.types.uint32.size);
				this.__mobilebackup2.writeRaw(chunkHeaderBuffer);

				this.__mobilebackup2.writeRaw(buffer);
				this.__statistics.sentSize += buffer.length;
			})
			.on("error", (err) => {
				if ("ENOENT" !== err.code) {
					console.log(`Failed to send ${file}: ${err.message}`);
				}

				this.__sendFileSendStatus(err);
				promise.callDone([false, err]);
			})
			.on("end", () => {
				this.__sendFileSendStatus();

				this.__statistics.sentFiles++;
				this.__updateStepProgress(1);

				promise.callDone([true]);
			});

		return promise;
	}

	/**
	 *
	 *
	 * @param {any} err
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__sendFileSendStatus(err) {
		// TODO: ref-struct?
		let statusBuffer = null;
		if (err) {
			const contentSize = ref.types.uint8.size + err.message.length;
			statusBuffer = Buffer.alloc(ref.types.uint32.size + contentSize);
			statusBuffer.writeUInt32BE(contentSize, 0);
			statusBuffer.writeUInt8(protocol.code.errorLocal, ref.types.uint32.size);
			statusBuffer.write(err.message, ref.types.uint32.size + ref.types.uint8.size);
		} else {
			const contentSize = ref.types.uint8.size;
			statusBuffer = Buffer.alloc(ref.types.uint32.size + contentSize);
			statusBuffer.writeUInt32BE(contentSize, 0);
			statusBuffer.writeUInt8(protocol.code.success, ref.types.uint32.size);
		}

		this.__mobilebackup2.writeRaw(statusBuffer);
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__receiveFiles(unknown, progress, totalSize) {
		this.__updateStep("Receiving files", totalSize, true);
		this.__updateOverallProgress(progress);

		return meaco(function* doReceiveFiles() {
			let hasMoreFiles = true;
			while (hasMoreFiles) {
				// Get the file name
				const originalFileName = yield this.__readFileName();
				if (!originalFileName) {
					break;
				}

				const destinationFileName = yield this.__readFileName();
				if (!destinationFileName) {
					return false;
				}

				hasMoreFiles = yield this.__receiveFileData(destinationFileName);
			}

			/* TODO: At this point, idevicebackup2 checks if there was some data left in the last chunk.
			 * Looking through the code I don't think it is necessary, but we need to verify. */

			// Send a final status to the device
			// TODO: status2 should be {} or left null?
			if (!(yield this.__mobilebackup2.sendStatusResponse(0, null, {}))) {
				console.log("Failed to send response to the device");
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {string} destinationFileName local path to save the received file to
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__receiveFileData(destinationFileName) {
		return meaco(function* doReceiveFileData() {
			// Open the local destination file
			const localFile = fs.createWriteStream(path.join(this.__backupDir, destinationFileName));

			/* We're going to read the current file's "parts". Each part has a fixed, 5 bytes, header:
			 * - The length of the current part (dword), including the next status byte.
			 * - A status byte (protocol.code.fileData indicates we actually have data). */
			let currentPartLength = yield this.__readDword();
			if (null === currentPartLength) {
				console.log("Failed to receive file data from the device");
				return false;
			}

			let code = yield this.__readStatusCode();
			if (null === code) {
				console.log("Failed to receive file data from the device");
				return false;
			}

			let previousCode = code;
			while (protocol.code.fileData === code) {
				/* Read the current block in chunks (TODO: Is this needed? what's the maximum block size).
				 * (Minus the size of the "code" byte we've read) */
				const dataSize = currentPartLength - 1;
				if (!(yield this.__readFileBlock(dataSize, localFile))) {
					return false;
				}

				this.__statistics.receivedSize += dataSize;
				this.__updateStepProgress(dataSize);

				// Read the size of the next "part"
				currentPartLength = yield this.__readDword();
				if (null === currentPartLength) {
					console.log("Failed to receive file data from the device");
					return false;
				}

				if (currentPartLength > 0) {
					// Read the next status code
					previousCode = code;
					code = yield this.__readStatusCode();
					if (null === code) {
						console.log("Failed to receive file data from the device");
						return false;
					}
				} else {
					// A 0 sized "part" indicates there are no more files
					break;
				}
			}

			localFile.end();
			this.__statistics.receivedFiles++;

			// Check if we've received an error message
			if (protocol.code.errorRemote === code) {
				// TODO: Is this the right order? (receive first, check previous code after)
				let errorMessage = null;
				if (currentPartLength > 1) {
					errorMessage = yield this.__mobilebackup2.readRaw(currentPartLength - 1);
				}

				/* According to idevicebackup2: If the file was sent using protocol.code.fileData,
				 * the end marker will be protocol.code.errorRemote which is not an error */
				if (protocol.code.fileData !== previousCode) {
					if (errorMessage) {
						console.log(`Received an error message from the device: ${errorMessage.toString()}`);
					} else {
						console.log("Recieved an error code from the device, but no error message");
					}
				}
			}

			// A 0 sized "part" should indicate there are no more files
			return (0 < currentPartLength);
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {number} blockSize
	 * @param {any} localFile
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__readFileBlock(blockSize, localFile) {
		return meaco(function* doReadFileBlock() {
			let dataLeft = blockSize;
			while (dataLeft > 0) {
				// Read the current chunk and write it to our local file
				const chunk = yield this.__mobilebackup2.readRaw(Math.min(READ_CHUNK_SIZE, dataLeft));
				if (!chunk) {
					console.log("Failed to recevie file data from the device");
					return false;
				}

				localFile.write(chunk);
				dataLeft -= chunk.length;
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__readFileName() {
		return meaco(function* doReadFileName() {
			// Read the size of the filename
			const fileNameSize = yield this.__readDword();
			if (!fileNameSize) {
				return null;
			}

			// Read the file name
			const fileName = yield this.__mobilebackup2.readRaw(fileNameSize);
			return fileName ? fileName.toString() : null;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @returnsed
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__readStatusCode() {
		return this.__mobilebackup2.readRaw(ref.types.uint8.size)
			.done.middleware((next, value) => {
				next(value ? value.readUInt8(0) : null);
			});
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__getFreeDiskSpace() {
		return meaco(function* doGetFreeDiskSpace() {
			const [error, driveInfo] = yield JarvisEmitter.emitify(diskusage.check)(this.__backupDir);
			const status = error === undefined ? 0 : error;
			const availableSpace = error ? 0 : driveInfo.available;

			if (!(yield this.__mobilebackup2.sendStatusResponse(status, null, availableSpace))) {
				console.log("Failed to send the free disk space to the device");
				return false;
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {string} dir
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__listDirectory(dir) {
		return meaco(function* doListDirectory() {
			const dirContents = {};

			yield walk(path.join(this.__backupDir, dir), true, false)
				.item((item) => {
					// Determine the entry type
					let type = protocol.listDirEntryType.unknown;
					if (item.stats.isDirectory()) {
						type = protocol.listDirEntryType.directory;
					} else if (item.stats.isFile()) {
						type = protocol.listDirEntryType.regularFile;
					}

					dirContents[item.name] = {
						DLFileType: type,
						DLFileSize: item.stats.size,
						DLFileModificationDate: dateToAppleDate(item.stats.mtime),
					};
				});

			if (!(yield this.__mobilebackup2.sendStatusResponse(0, null, dirContents))) {
				console.log("Failed to send the free disk space to the device");
				return false;
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {string} dir
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__makeDirecotry(dir) {
		return meaco(function* doMakeDirecotry() {
			// Create the dir under the backup dir (recursively)
			const dirFullPath = path.join(this.__backupDir, dir);
			const [error] = yield JarvisEmitter.emitify(fs.mkdirs)(dirFullPath, { mode: 0o755 });

			// Send a response to the device
			let responseSent = false;
			if (error) {
				console.log(`Failed to create local directory ${dir}: ${error.message}`);
				responseSent = yield this.__mobilebackup2.sendStatusResponse(this.__errorToDeviceError(error), error.message);
			} else {
				responseSent = yield this.__mobilebackup2.sendStatusResponse(0);
			}

			if (!responseSent) {
				console.log("Failed to send response to the device");
				return false;
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {any} moves
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__moveFiles(moves, unknown, progress) {
		this.__updateStep("Moving files", Object.keys(moves).length);
		this.__updateOverallProgress(progress);

		return meaco(function* doMoveFiles() {
			for (const item in moves) {
				const oldPath = path.join(this.__backupDir, item);
				const newPath = path.join(this.__backupDir, moves[item]);

				/* Make sure the target path doesn't exist (rename will fail if newPath
				 * is a non empty dir) */
				yield JarvisEmitter.emitify(fs.remove)(newPath);

				// Move source file/dir to the new path
				const [error] = yield JarvisEmitter.emitify(fs.rename)(oldPath, newPath);
				if (error) {
					console.log(`Failed to move local file ${oldPath} to ${newPath}: ${error.message}`);
					yield this.__mobilebackup2.sendStatusResponse(this.__errorToDeviceError(error), error.message);
					return false;
				}

				this.__updateStepProgress(1);
			}

			if (!(yield this.__mobilebackup2.sendStatusResponse(0, null, {}))) {
				console.log("Failed to send response to the device");
				return false;
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {any} files
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__removeFiles(files, unknown, progress) {
		this.__updateStep("Removing files", files.length);
		this.__updateOverallProgress(progress);

		return meaco(function* doRemoveFiles() {
			let status = 0;
			let errorMessage = null;

			for (const file of files) {
				const filePath = path.join(this.__backupDir, file);
				const [error] = yield JarvisEmitter.emitify(fs.remove)(filePath);
				if (error) {
					console.log(`Failed to remove local file ${file}: ${error.message}`);
					status = this.__errorToDeviceError(error);
					errorMessage = error.message;
				}

				this.__updateStepProgress(1);
			}

			if (!(this.__mobilebackup2.sendStatusResponse(status, errorMessage, {}))) {
				console.log("Failed to send response to the device");
				return false;
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__copyItem(source, destination) {
		this.__updateStep(`Copying file ${source}`, 1);

		return meaco(function* doCopyItem() {
			const oldPath = path.join(this.__backupDir, source);
			const newPath = path.join(this.__backupDir, destination);

			let responseSent = false;
			const [error] = yield JarvisEmitter.emitify(fs.copy)(oldPath, newPath);
			if (error) {
				console.log(`Failed to copy local file ${source} to ${destination}: ${error.message}`);
				responseSent = yield this.__mobilebackup2.sendStatusResponse(this.__errorToDeviceError(error), error.message);
			} else {
				responseSent = yield this.__mobilebackup2.sendStatusResponse(0);
			}

			if (!responseSent) {
				console.log("Failed to send response to the device");
				return false;
			}

			this.__updateStepProgress(1);
			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {number} value
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__sendDword(value) {
		const dwordBuffer = ref.alloc(ref.types.uint32);
		dwordBuffer.writeUInt32BE(value, 0);
		this.__mobilebackup2.writeRaw(dwordBuffer);
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__readDword() {
		return this.__mobilebackup2.readRaw(ref.types.uint32.size)
			.done.middleware((next, value) => {
				next(value ? value.readUInt32BE(0) : null);
			});
	}

	/**
	 *
	 *
	 * @param {number} progress
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__updateOverallProgress(progress) {
		this.callOverallProgress(progress);
	}

	/**
	 *
	 *
	 * @param {number} progress
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__updateStepProgress(progress) {
		this.callStepProgress(progress);
	}

	/**
	 *
	 *
	 * @param {string} name
	 * @param {number} total
	 * @param {boolean} [ticksAreData=false]
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__updateStep(name, total, ticksAreData = false) {
		this.callStep(name, total, ticksAreData);
	}

	/**
	 *
	 *
	 * @param {any} err
	 * @returns
	 *
	 * @memberof MobileBackup2MessageHandler
	 */
	__errorToDeviceError(err) {
		if (err.code === undefined) {
			return -1;
		}

		return ErrorToDeviceErrorMapping[err.code] || err.errno;
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = MobileBackup2MessageHandler;
