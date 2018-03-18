/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Exports
 *****************************************************************************/
// Define and parse the command line
module.exports = require("yargs")
	.usage("apps.js <command> [options]\nManage apps on iOS devices.")
	.command("list [--filter] [--output]", "List installed apps", (yargs) => {
		return yargs.option("filter", {
			alias: "f",
			describe: "Which applications to show (default is user)",
			choices: ["user", "system", "all"],
			default: "user",
		})
		.option("output", {
			alias: "o",
			choices: ["raw", "table", "xml"],
			default: "table",
		})
		.help();
	})
	.command("install <package>", "Install an app from a package file/dir")
	.command("uninstall <appid>", "Uninstall app, specified by it's app id")
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
