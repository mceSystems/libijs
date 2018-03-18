/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const { services: { getServices }, util: { appletime: { getTimeWithAppleEpoch } } } = require("../../../../../");

// mce Modules
const JarvisEmitter = require("jarvis-emitter");
const meaco = require("meaco");

// External modules
const crypto = require("crypto");

/******************************************************************************
 * Consts
 *****************************************************************************/
const ITUNES_FILES_BASE_FOLDER = "/iTunes_Control/iTunes";
const ITUNES_FILES = [
	"ApertureAlbumPrefs",
	"IC-Info.sidb",
	"IC-Info.sidv",
	"PhotosFolderAlbums",
	"PhotosFolderName",
	"PhotosFolderPrefs",
	"VoiceMemos.plist",
	"iPhotoAlbumPrefs",
	"iTunesApplicationIDs",
	"iTunesPrefs",
	"iTunesPrefs.plist",
];

const UUID_SIZE = 32;

/**
 *
 *
 * @returns
 */
const createUuid = function createUuid() {
	return crypto.randomBytes(UUID_SIZE).toString("hex").toUpperCase();
};


/**
 *
 *
 * @param {AFC} afc
 * @returns
 */
const getItunesFiles = function getItunesFiles(afc) {
	const downloadITunesFile = (file) => { return afc.readFile(`${ITUNES_FILES_BASE_FOLDER}/${file}`); };

	return JarvisEmitter.all(...ITUNES_FILES.map(downloadITunesFile))
		.done.middleware((next, fileContents) => {
			const downloadedItunesFiles = {};
			for	(let i = 0; i < ITUNES_FILES.length; i++) {
				if (fileContents[i]) {
					downloadedItunesFiles[ITUNES_FILES[i]] = fileContents[i];
				}
			}

			next(downloadedItunesFiles);
		});
};

/**
 *
 *
 * @param {any} device
 * @param {any} lockdownClient
 * @returns
 */
const getInstalledApps = function getInstalledApps(device, lockdownClient) {
	return meaco(function* doGetInstalledApps() {
		/* Start the installation_proxy and springboardservices, needed for getting the
		 * list of installed apps and their icons */
		const [installationProxy, springboardServices] = yield getServices(device, lockdownClient, "installation_proxy", "springboardservices");
		if (!installationProxy || !springboardServices) {
			console.log("Failed to connect to the installation_proxy\\springboardservices services");
			return null;
		}

		// Get the list of user installed apps
		const rawAppsList = yield installationProxy.browse({
			ApplicationType: "User",
			ReturnAttributes: ["CFBundleIdentifier", "ApplicationSINF", "iTunesMetadata"]
		});

		// Build a list of the install apps bundle ids, and a dict containing the apps entry and it's icon
		const appsBundleIds = [];
		const appsInfo = {};
		for (const appEntry of rawAppsList) {
			appsBundleIds.push(appEntry.CFBundleIdentifier);

			if (appEntry.ApplicationSINF && appEntry.iTunesMetadata) {
				appsInfo[appEntry.CFBundleIdentifier] = {
					ApplicationSINF: appEntry.ApplicationSINF,
					iTunesMetadata:  appEntry.iTunesMetadata,
					PlaceholderIcon: yield springboardServices.getIconPNGData(appEntry.CFBundleIdentifier),
				};
			}
		}

		// We don't need the services anymore
		JarvisEmitter.all(installationProxy.close(), springboardServices.close());

		return [appsBundleIds, appsInfo];
	});
};

/**
 *
 *
 * @param {any} device
 * @param {any} lockdownClient
 * @param {AFC} afc
 * @returns
 */
const buildInfoPlist = function buildInfoPlist(device, lockdownClient, afc) {
	return meaco(function* doBuildInfoPlist() {
		// Get the basic needed device info
		const deviceInfo = yield lockdownClient.getValue(null, null);
		if (!deviceInfo) {
			console.log("Failed to read the device info");
		}

		// Get a list of the user installed apps' bundle ids, and a dict containing the apps entry and it's icon
		const [appsBundleIds, appsInfo] = yield getInstalledApps(device, lockdownClient);

		// Build the initial info.plist
		const infoPlist = {
			"Target Identifier": deviceInfo.UniqueDeviceID,
			"Target Type": 		 "Device",
			"Unique Identifier": device.udid.toUpperCase(),

			BuildVersion: 		deviceInfo.BuildVersion,
			"Product Type": 	deviceInfo.ProductType,
			"Product Version":	deviceInfo.ProductVersion,
			"Serial Number": 	deviceInfo.SerialNumber,

			DeviceName: 	deviceInfo.DeviceName,
			"Display Name": deviceInfo.DeviceName,

			Applications: 			  appsInfo,
			"Installed Applications": appsBundleIds,

			GUID: 				createUuid(),
			"Last Backup Date": getTimeWithAppleEpoch(),

			"iTunes Files": 	yield getItunesFiles(afc),
			"iTunes Settings":	(yield lockdownClient.getValue("com.apple.iTunes", null)) || {},
			"iTunes Version":	(yield lockdownClient.getValue("com.apple.mobile.iTunes", "MinITunesVersion")) || "10.0.1",
		};

		// Optional parameters?
		if (deviceInfo.IntegratedCircuitCardIdentity) 		 { infoPlist.ICCID 			  = deviceInfo.IntegratedCircuitCardIdentity; }
		if (deviceInfo.InternationalMobileEquipmentIdentity) { infoPlist.IMEI  			  = deviceInfo.InternationalMobileEquipmentIdentity; }
		if (deviceInfo.MobileEquipmentIdentifier) 			 { infoPlist.MEID  			  = deviceInfo.MobileEquipmentIdentifier; }
		if (deviceInfo.PhoneNumber) 			 			 { infoPlist["Phone Number"]  = deviceInfo.PhoneNumber; }

		const iBooksData2 = yield afc.readFile("/Books/iBooksData2.plist");
		if (iBooksData2) {
			infoPlist["iBooks Data 2"] = iBooksData2;
		}

		return infoPlist;
	});
};

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = buildInfoPlist;
