/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const infoPlistBuilder = require("./infoPlistBuilder");
const MobileBackup2Action = require("../../MobileBackup2Action");

const { plist, services: { getService, AFC, NotificationProxy } } = require("../../../../../");

// mce Modules
const meaco = require("meaco");

// External Modules
const fs = require("fs-extra");
const path = require("path");
const bytes = require("bytes");

/******************************************************************************
 * Consts
 *****************************************************************************/
const SYNC_LOCK_FILE_PATH = "/com.apple.itunes.lock_sync";

/**
 *
 *
 * @class Backup
 * @extends {CommandHandler}
 */
class Backup extends MobileBackup2Action {
	/**
	 * Creates an instance of Backup.
	 *
	 * @param {any} options
	 *
	 * @memberof Backup
	 */
	constructor(options) {
		super(options);

		this.__afc = null;
		this.__syncLockFile = null;
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof Backup
	 */
	init() {
		const baseInit = super.init.bind(this);
		return meaco(function* doInit() {
			if (!(yield baseInit())) {
				return false;
			}

			// Start the AFC service
			this.__afc = yield getService(this._device, "afc", this._lockdownClient);
			if (!this.__afc) {
				console.log("Could not start the afc service");
				return false;
			}

			if (!(yield this._notificationManager.postNotification(NotificationProxy.Notifications.syncWillStart))) {
				return false;
			}

			// Lock the sync lock file
			if (!(yield this.__lockSync())) {
				return false;
			}

			// Make sure backup device sub-directory exists
			fs.ensureDirSync(path.join(this._options.directory, this._options.source), 0o755);

			// handle different source backup directory
			if (this._options.source !== this._options.udid) {
				// Make sure target backup device sub-directory exists
				fs.ensureDirSync(path.join(this._options.directory, this._options.udid), 0o755);

				// Use Info.plist in the target backup folder
				this._infoFilePath = path.join(this._options.directory, this._options.udid, "Info.plist");
			} else {
				// Use Info.plist from the source backup folder
				this._infoFilePath = path.join(this._options.directory, this._options.source, "Info.plist");
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof Backup
	 */
	close() {
		const baseClose = super.close.bind(this);
		return meaco(function* doClose() {
			if (this.__syncLockFile) {
				yield this.__syncLockFile.lock(AFC.LockFlags.unlock);
				yield this.__syncLockFile.close();
			}

			yield this._notificationManager.postNotification(NotificationProxy.Notifications.syncDidFinish);

			return yield baseClose();
		}.bind(this));
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof Backup
	 */
	run() {
		return meaco(function* doRun() {
			// If we don't have an existing info.plist file - force a full backup
			const haveExistingInfoPlist = fs.existsSync(this._infoFilePath);
			if (!this._options.full && !haveExistingInfoPlist) {
				this._options.full = true;
			}

			this.__printSettings(haveExistingInfoPlist);

			// Re-create Info.plist
			process.stdout.write("Building device info... ");
			const infoPlist = yield infoPlistBuilder(this._device, this._lockdownClient, this.__afc);
			if (null !== (yield plist.writeBinaryFile(infoPlist, this._infoFilePath))) {
				console.log("Failed to create Info.plist");
				return false;
			}
			console.log("DONE");

			// We don't need our lockdownd client anymore
			yield this._lockdownClient.close();
			this._lockdownClient = null;

			// Start the backup
			console.log("Starting backup...");
			const backupOptions = this._options.full ? { ForceFullBackup: true } : null;
			if (!(yield this._mobilebackup2.sendRequest("Backup", this._options.udid, this._options.source, backupOptions))) {
				console.log("Failed to start the backup");
				return false;
			}

			const backupStats = yield this._handleMessagesWithProgress();
			if (!backupStats) {
				return false;
			}

			// Verify the backup status
			if (!(yield this._checkSnapshotState("finished"))) {
				return false;
			}

			console.log(`Received ${backupStats.receivedFiles} files (${bytes(backupStats.receivedSize)}), Sent ${backupStats.sentFiles} files (${bytes(backupStats.sentSize)})`);
			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {boolean} haveExistingInfoPlist
	 * @memberof Backup
	 */
	__printSettings(haveExistingInfoPlist) {
		console.log("Backup settings:");

		console.log(`\t* Creating a backup for device: ${this._options.udid}`);
		console.log(`\t* Backup directory: ${this._options.directory}`);

		if (this._options.full) {
			if (haveExistingInfoPlist) {
				console.log("\t* Forcing full backup, local backup will be overwritten");
			} else {
				console.log("\t* Forcing full backup");
			}
		} else {
			console.log("\t* Found an existing backup, backup will be in incremental");
		}

		console.log(`\t* Backup ${this._willEncrypt ? "will" : "will not"} be encrypted`);
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof Backup
	 */
	__lockSync() {
		return meaco(function* doLockSync() {
			// Open the sync lock file
			this.__syncLockFile = yield this.__afc.openFile(SYNC_LOCK_FILE_PATH, "r+");
			if (!this.__syncLockFile) {
				console.log("Failed to open the sync lock");
				return false;
			}

			if (!(yield this._notificationManager.postNotification(NotificationProxy.Notifications.syncLockRequest))) {
				yield this.__syncLockFile.close();
				return false;
			}

			// TODO: Add attempts
			if (!(yield this.__syncLockFile.lock(AFC.LockFlags.exclusive))) {
				console.log("Failed to lock the sync lock file");
				yield this.__syncLockFile.close();
				return false;
			}

			return true;
		}.bind(this));
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = Backup;
