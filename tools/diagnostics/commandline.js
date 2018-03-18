/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Globals
 *****************************************************************************/
// Define and parse our command line
const args = require("yargs")
.usage("Usage: node index.js <command> [options]\nUse diagnostics interface of a device.")
.command("diagnostics <type>", "Print diagnostics information from device by TYPE (All, WiFi, GasGauge, NAND)", (yargs) => {
	return yargs
	.positional("type", {
		type: "string",
		required: true,
		choices: ["All", "WiFi", "GasGauge", "NAND"],
	});
})
.command("mobilegestalt [keys..]", "Get mobilegestalt values by keys (separated by spaces)")
.command("ioreg [--plane] [--entry] [--class]", "Print IORegistry of device, optionally by a plane, entry or class", (yargs) => {
	return yargs.option("plane", {
		type: "string",
		required: false,
		conflicts: ["entry", "class"],
	})
	.option("entry", {
		type: "string",
		required: false,
		conflicts: ["plane", "class"],
	})
	.option("class", {
		type: "string",
		required: false,
		conflicts: ["entry", "plane"],
	})
	.help();
})
.command("shutdown", "Shutdown the device")
.command("restart", "Restart the device")
.command("sleep", "Put the device into sleep mode (the device will disconnect from the host)")
.option("udid", {
	description: "target specific device by its 40-digit device UDID",
	required: false,
	alias: "u",
	type: "string",
	requiresArg: true,
})
.demand(1)
.strict()
.help()
.argv;

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = args;
