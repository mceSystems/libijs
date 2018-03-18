/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const libijs = require("../../..");
const zip = require("./lib/zip");
const progress = require("./lib/progress");

// mce Modules
const meaco = require("meaco");

// External Modules
const fs = require("fs");

/******************************************************************************
 * Consts
 *****************************************************************************/
const REMOTE_PACKAGE_DIR = "PublicStaging";

const ipaFilestoExtract = {
	info: /Payload\/(.+)\.app\/Info\.plist/,
	ApplicationSINF: /Payload\/(.+)\.app\/SC_Info\/(.*)\.sinf/,
	iTunesMetadata: /iTunesMetadata\.plist/,
};

/**
 * TODO
 *
 * @param {string} packagePath
 * @param {libijs.services.AFC} afc
 * @returns {JarvisEmitter}
 */
const handleIpcc = function handleIpcc(packagePath, afc) {
	return meaco(function* doHandleIpcc() {
		console.log("ipcc support wasn't not implemented yet");
	});
};

/**
 *
 *
 * @param {string} packagePath
 * @param {libijs.services.AFC} afc
 * @returns {JarvisEmitter}
 */
const handleIpa = function handleIpa(packagePath, afc) {
	return meaco(function* doHandleIpa() {
		// Extract the Info.plist, sinf file (if presnet) and iTunesMetadata.plist (if present)
		console.log("Reading application archive...");
		const extractedFiles = yield zip.extractFilesToBuffers(packagePath, ipaFilestoExtract);
		const appInfo = libijs.plist.parse(extractedFiles.info);

		const remotePackagePath = `${REMOTE_PACKAGE_DIR}/${appInfo.CFBundleIdentifier}`;

		// Upload the ipa file to the device
		console.log("Uploading archive to the device...");
		yield afc.uploadFile(packagePath, remotePackagePath);

		// Build the "client options" for the installation_proxy's install request
		const installationOptions = {
			CFBundleIdentifier: appInfo.CFBundleIdentifier,
		};
		if (extractedFiles.ApplicationSINF) {
			installationOptions.ApplicationSINF = extractedFiles.ApplicationSINF;
		}
		if (extractedFiles.iTunesMetadata) {
			installationOptions.iTunesMetadata = libijs.plist.parse(extractedFiles.iTunesMetadata);
		}

		return [remotePackagePath, installationOptions];
	});
};

/**
 *
 *
 * @param {string} packagePath
 * @param {libijs.services.AFC} afc
 * @returns {JarvisEmitter}
 */
const handleDirectory = function handleDirectory(packagePath, afc) {
	console.log(`Uploading direcotry ${packagePath}...`);
	return afc.uploadDir(packagePath, `${REMOTE_PACKAGE_DIR}/${packagePath}`)
		.done.middleware((next) => {
			// Return the "client options" for the installation_proxy's install request
			next({
				PackageType: "Developer",
			});
		});
};

/******************************************************************************
 * Exports
 *****************************************************************************/
/**
 *
 *
 * @param {libijs.Device} device
 * @param {libijs.services.InstallationProxy} installationProxy
 * @param {Object} config
 * @returns {JarvisEmitter}
 */
module.exports = function installApp(device, installationProxy, config) {
	return meaco(function* doInstallApp() {
		// Start the AFC service
		const afc = yield libijs.services.getService(device, "afc");
		if (!afc) {
			console.log("Could not start the afc service");
			return false;
		}

		// Make sure the remote staging dir exists
		yield afc.makeDirectory(REMOTE_PACKAGE_DIR);

		// Determinate the packge type - dir (developer), ipcc or an ipa
		let packageHandler = null;
		if (fs.statSync(config.package).isDirectory()) {
			packageHandler = handleDirectory;
		} else if (config.package.endsWith(".ipcc")) {
			packageHandler = handleIpcc;
		} else {
			packageHandler = handleIpa;
		}

		const [remotePackagePath, installClientOptions] = yield packageHandler(config.package, afc);

		// Note that the extra "\n" is for the progress/status bar
		console.log("Installing app...\n");
		return yield installationProxy.install(remotePackagePath, installClientOptions)
			.step(progress.renderStep);
	});
};
