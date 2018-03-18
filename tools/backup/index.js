/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const commandline = require("./commandline");

// mce Modules
const meaco = require("meaco");

/******************************************************************************
 * Consts
 *****************************************************************************/
const actions = {
	backup: require("./lib/actions/Backup"),
	restore: require("./lib/actions/Restore"),
};

/**
 *
 *
 * @param {number} durationInSeconds
 * @returns {string}
 */
const getPrintableDuration = function getPrintableDuration(durationInSeconds) {
	// For durations shorter the one minute, we'll just print them as seconds
	if (durationInSeconds < 60) {
		return `${Math.round(durationInSeconds)} seconds`;
	}

	// For longer durations, we'll print the minutes and seconds separately
	const durationMinutes = Math.round(durationInSeconds / 60);
	const durationSeconds = Math.round(durationInSeconds % 60);

	// Pad the minutes/seconds if needed
	const printableDurationMinutes = (durationMinutes < 10) ? (`0${durationMinutes}`) : durationMinutes;
	const printableDurationSeconds = (durationSeconds < 10) ? (`0${durationSeconds}`) : durationSeconds;

	return `${printableDurationMinutes}:${printableDurationSeconds} minutes`;
};

/******************************************************************************
 * Entry Point
 *****************************************************************************/
meaco(function* main() {
	const ActionClass = actions[commandline.args._[0]];
	const action = new ActionClass(commandline.args);

	const startTime = Date.now();

	if (!(yield action.init())) {
		return false;
	}

	if (!(yield action.run())) {
		console.log("Failed, disconnecting...");
		yield action.close();
		return false;
	}

	const durationInSeconds = (Date.now() - startTime) / 1000;
	console.log(`Finished in ${getPrintableDuration(durationInSeconds)}, disconnecting...`);

	yield action.close();

	console.log("DONE");
	return true;
})
.error((err) => {
	console.log(err);
	process.exit(1);
})
.done((result) => {
	process.exit(result ? 0 : 1);
});
