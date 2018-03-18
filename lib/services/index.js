/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const lockdownd = require("../lockdownd");

// mce Modules
const meaco = require("meaco");
const JarvisEmitter = require("jarvis-emitter");

// External Modules
const debug = require("debug")("libijs:services");

/******************************************************************************
 * Consts
 *****************************************************************************/
const SERVICES = {
	afc: {
		serviceName: "com.apple.afc",
		module: "./afc",
		sendEscrowBag: false,
	},
	syslog_relay: {
		serviceName: "com.apple.syslog_relay",
		module: "./SyslogRelay",
		sendEscrowBag: false,
	},
	diagnostics_relay: {
		serviceName: "com.apple.mobile.diagnostics_relay",
		module: "./DiagnosticsRelay",
		sendEscrowBag: false,
	},
	mobileactivationd: {
		serviceName: "com.apple.mobileactivationd",
		module: "./MobileActivation",
		sendEscrowBag: true,
	},
	mobilebackup2: {
		serviceName: "com.apple.mobilebackup2",
		module: "./MobileBackup2",
		sendEscrowBag: true,
	},
	notification_proxy: {
		serviceName: "com.apple.mobile.notification_proxy",
		module: "./NotificationProxy",
		sendEscrowBag: false,
	},
	installation_proxy: {
		serviceName: "com.apple.mobile.installation_proxy",
		module: "./InstallationProxy",
		sendEscrowBag: false,
	},
	springboardservices: {
		serviceName: "com.apple.springboardservices",
		module: "./SpringBoardServices",
		sendEscrowBag: false,
	},
	MCInstall: {
		serviceName: "com.apple.mobile.MCInstall",
		module: "./MCInstall",
		sendEscrowBag: false,
	},
};

/**
 *
 *
 * @param {Device} device
 * @param {string} serviceName
 * @param {lockdownd.Client} [lockdowndClient=null]
 * @returns
 */
const getService = function getService(device, serviceName, lockdowndClient = null) {
	return meaco(function* doGetService() {
		// Create a new (temp) lockdownd client if we don't have one
		let shouldCloseLockdowndClient = false;
		if (!lockdowndClient) {
			lockdowndClient = yield lockdownd.getClient(device);
			if (!lockdowndClient) {
				debug("Failed to connect to lockdownd");
				return null;
			}

			shouldCloseLockdowndClient = true;
		}

		const serviceSettings = SERVICES[serviceName];
		try {
			// Start the service
			const serviceDescriptor = yield lockdowndClient.startService(serviceSettings.serviceName, serviceSettings.sendEscrowBag);
			if (!serviceDescriptor) {
				debug(`Failed to start ${serviceSettings.serviceName} service`);
				return null;
			}

			// Connect to the new service instance
			const connection = yield device.connect(serviceDescriptor.port);
			if (!connection) {
				debug(`Failed to connect to the ${serviceSettings.serviceName} service at port ${serviceDescriptor.port}`);
				return null;
			}

			// Initialize the service client
			const ServiceClass = require(serviceSettings.module);
			const serviceInstance = new ServiceClass(connection);
			if (!(yield serviceInstance.init(serviceDescriptor.sslEnabled))) {
				debug(`Failed to initialize ${serviceSettings.serviceName} service`);
				return null;
			}

			return serviceInstance;
		} finally {
			// Cleanup
			if (shouldCloseLockdowndClient) {
				yield lockdowndClient.close();
			}
		}
	});
};

/**
 *
 *
 * @param {Device} device
 * @param {lockdownd.Client} lockdowndClient
 * @param {string[]} services
 * @returns
 */
const getServices = function getServices(device, lockdowndClient, ...services) {
	return JarvisEmitter.all(...(services.map((service) => {
		return getService(device, service, lockdowndClient);
	})));
};

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	getService,
	getServices,

	// Export service classes which have static properties needed by users
	NotificationProxy: require("./NotificationProxy"),
	AFC: require("./afc"),
	DiagnosticsRelay: require("./DiagnosticsRelay"),
};
