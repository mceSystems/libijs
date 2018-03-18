/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const PropertyListService = require("../PropertyListService");

// mce Modules
const JarvisEmitter = require("jarvis-emitter");
const meaco = require("meaco");

// External Modules
const debug = require("debug")("libijs:services:notification_proxy");

/******************************************************************************
 * Consts
 *****************************************************************************/
const Notifications = {
	// Notifications that can be sent
	syncWillStart:   "com.apple.itunes-mobdev.syncWillStart",
	syncDidStart:    "com.apple.itunes-mobdev.syncDidStart",
	syncDidFinish:   "com.apple.itunes-mobdev.syncDidFinish",
	syncLockRequest: "com.apple.itunes-mobdev.syncLockRequest",

	// Notifications that can be received
	syncCancelRequest:            "com.apple.itunes-client.syncCancelRequest",
	syncSuspendRequest:           "com.apple.itunes-client.syncSuspendRequest",
	syncResumeRequest:            "com.apple.itunes-client.syncResumeRequest",
	phoneNumberChanged:           "com.apple.mobile.lockdown.phone_number_changed",
	deviceNameChanged:            "com.apple.mobile.lockdown.device_name_changed",
	timezoneChanged:              "com.apple.mobile.lockdown.timezone_changed",
	trustedHostAttached:          "com.apple.mobile.lockdown.trusted_host_attached",
	hostDetached:                 "com.apple.mobile.lockdown.host_detached",
	hostAttached:                 "com.apple.mobile.lockdown.host_attached",
	registrationFailed:           "com.apple.mobile.lockdown.registration_failed",
	activationState:              "com.apple.mobile.lockdown.activation_state",
	brickState:                   "com.apple.mobile.lockdown.brick_state",
	diskUsageChanged:             "com.apple.mobile.lockdown.disk_usage_changed",
	domainChanged:                "com.apple.mobile.data_sync.domain_changed",
	backupDomainChanged:          "com.apple.mobile.backup.domain_changed",
	applicationInstalled:         "com.apple.mobile.application_installed",
	applicationUninstalled:       "com.apple.mobile.application_uninstalled",
	developerImageMounted:        "com.apple.mobile.developer_image_mounted",
	attemptActivation:            "com.apple.springboard.attemptactivation",
	itdbprepDidEnd:               "com.apple.itdbprep.notification.didEnd",
	languageChanged:              "com.apple.language.changed",
	AddressBookPreferenceChanged: "com.apple.AddressBook.PreferenceChanged",
};

/**
 *
 *
 * @class NotificationProxy
 * @extends {PropertyListService}
 */
class NotificationProxy extends PropertyListService {
	/**
	 * Creates an instance of NotificationProxy.
	 *
	 * @param {UsbmuxdDeviceConnection} connection
	 *
	 * @memberof NotificationProxy
	 */
	constructor(connection) {
		super(connection);

		this.extend([
			JarvisEmitter
                .interfaceProperty()
                .name("notification")
                .role(JarvisEmitter.role.event)
                .description("Triggered when a new notification is received from the service")
                .build(),
		]);

		// We'll start in "request-response" mode until the user calls observeNotifications
		this.mode = PropertyListService.Mode.RequestResponse;

		// Set the notification handler
		this.data((message) => {
			if ("RelayNotification" === message.Command) {
				this.callNotification(message.Name);
			} else {
				// TODO: Handle other commands (like "ProxyDeath")
				this.callNotification(null);
			}
		});
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof NotificationProxy
	 */
	close() {
		const baseClose = super.close.bind(this);
		return meaco(function* doObserveNotifications() {
			this.mode = PropertyListService.Mode.RequestResponse;
			yield this._writeXml({ Command: "Shutdown" });
			yield baseClose;

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @readonly
	 * @static
	 *
	 * @memberof NotificationProxy
	 */
	static get Notifications() { return Notifications; }

	/**
	 *
	 *
	 * @param {string} notification
	 * @returns {JarvisEmitter}
	 *
	 * @memberof NotificationProxy
	 */
	postNotification(notification) {
		const oldMode = this.mode;
		this.mode = PropertyListService.Mode.RequestResponse;

		return this._writeXml({ Command: "PostNotification", Name: notification }, false)
			.done(() => {
				this.mode = oldMode;
			});
	}

	/**
	 *
	 *
	 * @param {string[]} notificationsToObserve
	 * @returns {JarvisEmitter}
	 *
	 * @memberof NotificationProxy
	 */
	observeNotifications(notificationsToObserve) {
		return meaco(function* doObserveNotifications() {
			for (const notification of notificationsToObserve) {
				if (!(yield this._writeXml({ Command: "ObserveNotification", Name: notification }, false))) {
					debug(`Failed to send ObserveNotification command for: ${notification}`);
					return false;
				}
			}

			// Start handling notifications automatically
			this.mode = PropertyListService.Mode.Events;

			return true;
		}.bind(this));
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = NotificationProxy;
