/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const plist = require("../../..").plist;

// External Modules
const Table = require("cli-table2");

/******************************************************************************
 * Consts
 *****************************************************************************/
const emptyTableChars = {
	top: "",
	"top-mid": "",
	"top-left": "",
	"top-right": "",
	bottom: "",
	"bottom-mid": "",
	"bottom-left": "",
	"bottom-right": "",
	left: "",
	"left-mid": "",
	mid: "",
	"mid-mid": "",
	right: "",
	"right-mid": "",
	middle: " ",
};

/******************************************************************************
 * Exports
 *****************************************************************************/
/**
 *
 *
 * @param {Device} device
 * @param {InstallationProxy} installationProxy
 * @returns
 */
module.exports = function listApps(device, installationProxy, config) {
	const options = {};

	// Filter the apps, if needed
	if ("user" === config.filter) {
		options.ApplicationType = "User";
	} else if ("system" === config.filter) {
		options.ApplicationType = "System";
	}

	// Handle plist xml output
	if ("xml" === config.output) {
		return installationProxy.browse(options)
			.done.middleware((next, apps) => {
				if (!apps) {
					return next(false);
				}

				console.log(plist.createXml(apps, true));
				next(true);
			});
	}

	// Initialize our "table renderer"
	const outputTableOptions = {
		head: ["CFBundleIdentifier", "CFBundleVersion", "CFBundleDisplayName"],
		style: {
			head: [],
			border: [],
		},
		wordWrap: true,
	};
	if ("raw" === config.output) {
		// "raw" means no borders
		outputTableOptions.chars = emptyTableChars;
	}

	const appsTable = new Table(outputTableOptions);

	// Get the apps list, adding each app to our table
	options.ReturnAttributes = ["CFBundleIdentifier", "CFBundleDisplayName", "CFBundleVersion"];
	return installationProxy.browse(options)
		.step((app) => {
			appsTable.push([app.CFBundleIdentifier, app.CFBundleVersion, app.CFBundleDisplayName]);
		})
		.done.middleware((next, apps) => {
			if (!apps) {
				return next(false);
			}

			console.log(appsTable.toString());
			next(true);
		});
};
