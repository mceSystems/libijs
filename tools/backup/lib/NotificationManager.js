/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const { services: { getService, NotificationProxy } } = require("../../../");

// mce Modules
const meaco = require("meaco");

/**
 *
 *
 * @class NotificationManager
 */
class NotificationManager {
	/**
	 * Creates an instance of NotificationManager.
	 *
	 * @param {any} device
	 *
	 * @memberof NotificationManager
	 */
	constructor(device) {
		this.__device = device;
	}

	/**
	 *
	 *
	 * @param {any} lockdownClient
	 * @returns
	 *
	 * @memberof NotificationManager
	 */
	init(lockdownClient) {
		return meaco(function* doInit() {
			// Start the notification_proxy service
			this._notificationObserver = yield getService(this.__device, "notification_proxy", lockdownClient);
			if (!this._notificationObserver) {
				console.log("Could not start the notification_proxy service");
				return false;
			}

			this._notificationObserver.notification((notification) => {
				// TODO
			});

			const notifications = [
				NotificationProxy.Notifications.syncCancelRequest,
				NotificationProxy.Notifications.syncSuspendRequest,
				NotificationProxy.Notifications.syncResumeRequest,
				NotificationProxy.Notifications.backupDomainChanged,
			];
			if (!(yield this._notificationObserver.observeNotifications(notifications))) {
				console.log("Could not register for notifications");
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
	 * @memberof NotificationManager
	 */
	close() {
		return this._notificationObserver.close();
	}

	/**
	 *
	 *
	 * @param {any} notification
	 * @returns
	 *
	 * @memberof NotificationManager
	 */
	postNotification(notification) {
		return meaco(function* doPostNotification() {
			// Start the notification_proxy service
			const notificationProxy = yield getService(this.__device, "notification_proxy");
			if (!notificationProxy) {
				console.log("Could not start the notification_proxy service");
				return false;
			}

			// Post the notification
			const postResult = yield notificationProxy.postNotification(notification);
			yield notificationProxy.close();

			if (!postResult) {
				console.log(`Failed to post "${notification}" notification`);
				return false;
			}
			return true;
		}.bind(this));
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = NotificationManager;
