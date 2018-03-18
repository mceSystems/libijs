/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const NotificationManager = require("./NotificationManager");
const MobileBackup2MessageHandler = require("./MobileBackup2MessageHandler");
const ProgressDisplay = require("./ProgressDisplay");

// libijs
const libijs = require("../../../");
const { services: { getService }, plist, lockdownd } = libijs;

// mce Modules
const meaco = require("meaco");
const JarvisEmitter = require("jarvis-emitter");

// External Modules
const path = require("path");

/******************************************************************************
 * Consts
 *****************************************************************************/
const MOBILEBACKUP2_VERSIONS = [2.0, 2.1];

/**
 *
 *
 * @class MobileBackup2Action
 */
class MobileBackup2Action {
	/**
	 * Creates an instance of MobileBackup2Action.
	 *
	 * @param {any} options
	 *
	 * @memberof MobileBackup2Action
	 */
	constructor(options = {}) {
		this._options = options;
		this._device = null;
		this._lockdownClient = null;
		this._mobilebackup2 = null;
		this._notificationManager = null;
		this._willEncrypt = false;

		const libijsOptions = options.usbmuxd ? { usbmuxdAddress: options.usbmuxd } : {};
		this._deviceManager = libijs.createClient(libijsOptions).deviceManager;
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof CommandHandler
	 */
	init() {
		return meaco(function* doInit() {
			yield JarvisEmitter.emitify(this._deviceManager.ready)();
			this._device = this._deviceManager.getDevice(this._options.udid);
			if (!this._device) {
				console.log("No device found, is it plugged in?");
				return false;
			}

			// Make sure the we have a udid and source device (udid)
			this._options.udid = this._device.udid;
			if (!this._options.source) {
				this._options.source = this._device.udid;
			}

			process.stdout.write("Connecting to device... ");

			// Connect to lockdownd
			this._lockdownClient = yield lockdownd.getClient(this._device);
			if (!this._lockdownClient) {
				console.log("Could not connect to lockdownd");
				return false;
			}

			this._willEncrypt = yield this._lockdownClient.getValue("com.apple.mobile.backup", "WillEncrypt");

			// Start the notifications observer (notification_proxy service)
			this._notificationManager = new NotificationManager(this._device);
			if (!(yield this._notificationManager.init(this._lockdownClient))) {
				console.log("Could not start the notification proxy service");
				return false;
			}

			// Start the mobilebackup2 service
			this._mobilebackup2 = yield getService(this._device, "mobilebackup2", this._lockdownClient);
			if (!this._mobilebackup2) {
				console.log("Could not start the mobilebackup2 service");
				return false;
			}

			/* The first step when working with the mobilebackup2 service is exchanging versions, making sure
			 * we can talk */
			const remoteServiceVersion = yield this._mobilebackup2.versionExchange(MOBILEBACKUP2_VERSIONS);
			if (!remoteServiceVersion) {
				console.log("Could not perform backup protocol version exchange");
				return false;
			}

			console.log("DONE");
			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof CommandHandler
	 */
	close() {
		const promises = [];

		if (this._lockdownClient) {
			promises.push(this._lockdownClient.close());
		}
		if (this._mobilebackup2) {
			promises.push(this._mobilebackup2.close());
		}
		if (this._notificationManager) {
			promises.push(this._notificationManager.close());
		}

		if (0 === promises.length) {
			return new JarvisEmitter().callDone(true);
		}

		return JarvisEmitter.all(...promises)
			.done(() => {
				this._lockdownClient = null;
				this._mobilebackup2 = null;
				this._notificationManager = null;
			});
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof MobileBackup2Action
	 */
	_handleMessagesWithProgress() {
		process.stdout.write("\n");
		const progressDisplay = new ProgressDisplay();

		const messageHandler = new MobileBackup2MessageHandler(this._mobilebackup2, this._options.directory);

		// Wire the message handler's events to the progress display
		messageHandler.overallProgress((progress) => {
			progressDisplay.updateTotalProgress(progress);
		});
		messageHandler.step((name, total, ticksAreData) => {
			const units = ticksAreData ? ProgressDisplay.Units.Bytes : ProgressDisplay.Units.Files;
			progressDisplay.setStep(name, units, total);
		});
		messageHandler.stepProgress((step) => {
			progressDisplay.updateStepProgress(step);
		});

		return messageHandler.handleMessages()
			.done(() => {
				progressDisplay.close();
				process.stdout.write("\n");
			});
	}

	/**
	 *
	 *
	 * @param {any} expectedState
	 * @returns
	 *
	 * @memberof MobileBackup2Action
	 */
	_checkSnapshotState(expectedState) {
		const statusFilePath = path.join(this._options.directory, this._device.udid, "Status.plist");

		return plist.readFile(statusFilePath)
			.done.middleware((next, status) => {
				if (!status) {
					console.log("Could not read Status.plist from the backup directory");
					return next(false);
				}

				next(expectedState === status.SnapshotState);
			});
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = MobileBackup2Action;
