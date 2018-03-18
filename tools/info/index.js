/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const libijs = require("../../");
const printObject = require("../lib/printObject");

// mce Modules
const meaco = require("meaco");

/******************************************************************************
 * Consts
 *****************************************************************************/
const KNOWN_DOMAINS = [
	"com.apple.disk_usage",
	"com.apple.disk_usage.factory",
	"com.apple.mobile.battery",
	"com.apple.iqagent",
	"com.apple.purplebuddy",
	"com.apple.PurpleBuddy",
	"com.apple.mobile.chaperone",
	"com.apple.mobile.third_party_termination",
	"com.apple.mobile.lockdownd",
	"com.apple.mobile.lockdown_cache",
	"com.apple.xcode.developerdomain",
	"com.apple.international",
	"com.apple.mobile.data_sync",
	"com.apple.mobile.tethered_sync",
	"com.apple.mobile.mobile_application_usage",
	"com.apple.mobile.backup",
	"com.apple.mobile.nikita",
	"com.apple.mobile.restriction",
	"com.apple.mobile.user_preferences",
	"com.apple.mobile.sync_data_class",
	"com.apple.mobile.software_behavior",
	"com.apple.mobile.iTunes.SQLMusicLibraryPostProcessCommands",
	"com.apple.mobile.iTunes.accessories",
	"com.apple.mobile.internal",
	"com.apple.mobile.wireless_lockdown",
	"com.apple.fairplay",
	"com.apple.iTunes",
	"com.apple.mobile.iTunes.store",
	"com.apple.mobile.iTunes",
];

// Define and parse the command line
const argv = require("yargs")
	.usage("info.js OPTIONS\nShow information about a device.")
	.option("udid", {
		description: "target specific device by its 40-digit device UDID",
		required: false,
		alias: "u",
		type: "string",
		requiresArg: true,
	})
	.option("domain", {
		description: "Query a specific domain",
		required: false,
		alias: "q",
		type: "string",
		requiresArg: true,
	})
	.option("key", {
		description: "Query a specific key",
		required: false,
		alias: "k",
		type: "string",
		requiresArg: true,
	})
	.strict()
	.help()
	.fail((msg, err, yargs) => {
		yargs.showHelp();

		console.log("  Known domains:");
		for (const domain of KNOWN_DOMAINS) {
			console.log(`  \t${domain}`);
		}

		console.log("\n", msg);
		process.exit(1);
	})
	.argv;

/**
 *
 *
 * @param {libijs.Device} device
 * @param {string} [domain=null]
 * @param {string} [key=null]
 */
const queryDevice = function queryDevice(device, domain = null, key = null) {
	meaco(function* doQueryDevice() {
		// Connect to lockdownd
		const lockdownClient = yield libijs.lockdownd.getClient(device);
		if (!lockdownClient) {
			console.log("Could not connect to lockdownd");
			return false;
		}

		if (domain && (-1 === KNOWN_DOMAINS.indexOf(domain))) {
			console.log(`Warning: ${domain} is not a known domain`);
		}

		// Query the specified domain/key
		const result = yield lockdownClient.getValue(domain, key);
		yield lockdownClient.close();
		if (!result) {
			console.log("Failed to query the device");
			return false;
		}

		printObject(result);
		return true;
	})
	.done((result) => {
		process.exit(result ? 0 : 1);
	});
};

/******************************************************************************
 * Entry Point
 *****************************************************************************/
const deviceManager = libijs.createClient().deviceManager;
deviceManager.ready(() => {
	const device = deviceManager.getDevice(this._udid);
	if (device) {
		queryDevice(device, argv.domain, argv.key);
	} else {
		console.log("Couldn't find device");
	}
});
