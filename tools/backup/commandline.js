/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Globals
 *****************************************************************************/
// Define and parse the command line
const args = require("yargs")
	.usage("Usage: node index.js [OPTIONS] CMD [CMDOPTIONS] DIRECTORY\nCreate or restore backup from the current or specified directory.\nUse \"backup -h\" or \"restore -h\" for more help.")
	.command("backup [--full] <directory>", "create backup for the device", (yargs) => {
		return yargs.option("full", {
			description: "force full backup from device",
			required: false,
			default: false,
			boolean: true,
		})
		.help();
	})
	.command("restore [--system] [--reboot] [--copy] [--settings] [--remove] [--password] <directory>", "restore last backup to the device", (yargs) => {
		return yargs
		.option("system", {
			description: "restore system files, too",
			boolean: true,
			required: false,
			default: false,
		})
		.option("reboot", {
			description: "reboot the system when done",
			boolean: true,
			required: false,
			default: false,
		})
		.option("copy", {
			description: "create a copy of backup folder before restoring",
			boolean: true,
			required: false,
			default: false,
		})
		.option("settings", {
			description: "restore device settings from the backup",
			boolean: true,
			required: false,
			default: false,
		})
		.option("remove", {
			description: "remove items which are not being restored",
			boolean: true,
			required: false,
			default: false,
		})
		.option("password", {
			description: "supply the password of the source backup",
			type: "string",
			required: false,
			requiresArg: true,
		})
		.help();
	})
	.option("usbmuxd", {
		hidden: true,
	})
	.coerce("usbmuxd", (usbmuxd) => {
		const keysCount = Object.keys(usbmuxd).length;
		if (usbmuxd.unix && (1 === keysCount)) {
			return { path: usbmuxd.unix };
		}
		if (usbmuxd.host && usbmuxd.port && (2 === keysCount)) {
			return usbmuxd;
		}

		throw new Error("Inavlid usbmuxd parameters");
	})
	.option("usbmuxd.host", {
		description: "Use a custom usbmuxd host address. Requires usbmuxd.port, incompatible with usbmuxd.unix.",
		required: false,
		type: "string",
		requiresArg: true,
	})
	.option("usbmuxd.port", {
		description: "Use a custom usbmuxd TCP port. Requires usbmuxd.host, incompatible with usbmuxd.unix.",
		required: false,
		type: "number",
		requiresArg: true,
	})
	.option("usbmuxd.unix", {
		description: "Use a custom usbmuxd unix socket path. Incompatible with usbmuxd.host\\usbmuxd.post.",
		required: false,
		type: "string",
		requiresArg: true,
	})
	.option("udid", {
		description: "target specific device by its 40-digit device UDID",
		required: false,
		alias: "u",
		type: "string",
		requiresArg: true,
	})
	.option("source", {
		description: "use backup data from device specified by UDID",
		required: false,
		alias: "s",
		type: "string",
		requiresArg: true,
	})
	.option("interctive", {
		description: "request passwords interactively",
		required: false,
		alias: "i",
		boolean: true,
	})
	.demand(1)
	.strict()
	.help()
	.argv;

if (!args.source) {
	args.source = args.udid;
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = { args };
