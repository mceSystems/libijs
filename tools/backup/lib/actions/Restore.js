/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const MobileBackup2Action = require("../MobileBackup2Action");
const prompt = require("../../../lib/prompt");
const plist = require("../../../../").plist;

// mce Modules
const meaco = require("meaco");

// External Modules
const fs = require("fs");
const path = require("path");
const bytes = require("bytes");

/**
 *
 *
 * @class Restore
 * @extends {MobileBackup2Action}
 */
class Restore extends MobileBackup2Action {
	/**
	 * Creates an instance of Restore.
	 *
	 * @param {any} options
	 *
	 * @memberof Restore
	 */
	constructor(options) {
		super(options);

		this.__isEncrypted = false;
		this.__password = options.password;
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof Restore
	 */
	init() {
		const baseInit = super.init.bind(this);
		return meaco(function* doInit() {
			if (!(yield baseInit())) {
				return false;
			}

			// We don't need our lockdownd client
			yield this._lockdownClient.close();
			this._lockdownClient = null;

			// Make sure the backup directory contains an info.plist file
			const infoFilePath = path.join(this._options.directory, this._options.source, "Info.plist");
			if (!fs.existsSync(infoFilePath)) {
				console.log("Invalid backup directory (missing Info.plist)");
				return false;
			}

			// Make sure this is a successful backup
			if (!(yield this._checkSnapshotState("finished"))) {
				console.log("Could not verify the backup was a successful backup");
				return false;
			}

			// Read the manifest.plist file to determine if the backup will be encrypted or not
			const manifestFilePath = path.join(this._options.directory, this._options.source, "Manifest.plist");
			const manifest = yield plist.readFile(manifestFilePath);
			if (!manifest) {
				console.log("Invalid backup directory (missing Manifest.plist)");
				return false;
			}

			// If we needed (and possible), ask the user for the backup's password
			if (manifest.IsEncrypted) {
				if (!this.__password) {
					if (!this._options.interctive) {
						console.log("Backup is encrypted, but no passowrd was supplied. Either pass it on the command line, or use --interactive");
						return false;
					}

					this.__password = yield prompt.question("Please enter the passowrd of the backup:", true);
				} else {
					console.log("Restoring from an encrypted backup, using the supplied password");
				}
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof Restore
	 */
	run() {
		console.log("Starting restore...");
		return meaco(function* doRun() {
			// Create the restore settings (options)
			const restoreOptions = {
				RestoreSystemFiles: this._options.system,
				RestorePreserveSettings: !this._options.settings,
			};

			if (!this._options.reboot) {
				restoreOptions.RestoreShouldReboot = false;
			}
			if (!this._options.copy) {
				restoreOptions.RestoreDontCopyBackup = true;
			}
			if (this._options.remove) {
				restoreOptions.RemoveItemsNotRestored = true;
			}
			if (this.__password) {
				restoreOptions.Password = this.__password;
			}

			this.__printSettings(restoreOptions);

			// Start the restore
			if (!(yield this._mobilebackup2.sendRequest("Restore", this._options.udid, this._options.source, restoreOptions))) {
				console.log("Failed to start the restore");
				return false;
			}

			const restoreStats = yield this._handleMessagesWithProgress();
			if (!restoreStats) {
				return false;
			}

			console.log(`Sent ${restoreStats.sentFiles} files (${bytes(restoreStats.sentSize)}), received ${restoreStats.receivedFiles} files (${bytes(restoreStats.receivedSize)})`);
			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @memberof Restore
	 */
	__printSettings(restoreOptions) {
		console.log("Restore settings:");

		// Note that if RestoreShouldReboot isn't specified, it defaults to true
		const shouldReboot = ("boolean" === typeof restoreOptions.RestoreShouldReboot) ? restoreOptions.RestoreShouldReboot : true;

		console.log(`\t* Backup directory: ${this._options.directory}`);
		this.__printBoolSetting("Restoring system files", restoreOptions.RestoreSystemFiles);
		this.__printBoolSetting("Rebooting after restore", shouldReboot);
		this.__printBoolSetting("Preserving the device settings", restoreOptions.RestorePreserveSettings);
		this.__printBoolSetting("Don't copy backup", restoreOptions.RestoreDontCopyBackup);
		this.__printBoolSetting("Removing items that are not restored", restoreOptions.RemoveItemsNotRestored);

		if (this.__password) {
			console.log("\t* Backup is encrypted, will be using a password");
		} else {
			console.log("\t* Backup is not encrypted (no password is necessary)");
		}
	}

	/**
	 *
	 *
	 * @param {string} setting
	 * @param {boolean} value
	 *
	 * @memberof Restore
	 */
	__printBoolSetting(setting, value) {
		console.log(`\t* ${setting}: ${value ? "Yes" : "No"}`);
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = Restore;
