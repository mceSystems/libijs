/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
// mce Modules
const JarvisEmitter = require("jarvis-emitter");

// External Modules
const MuteStream = require("mute-stream");
const readline = require("readline");

/**
 *
 *
 * @param {string} query
 * @param {boolean} [hideInput=false]
 * @returns {JarvisEmitter}
 */
const question = function question(query, hideInput = false) {
	const promise = new JarvisEmitter();

	let outputStream = null;
	if (hideInput) {
		outputStream = new MuteStream({
			replace: "*",
			prompt: query,
		});
		outputStream.pipe(process.stdout);
		outputStream.mute();
	} else {
		outputStream = process.stdout;
	}

	const readLine = readline.createInterface({
		input: process.stdin,
		output: outputStream,
	});

	readLine.question(query, (answer) => {
		promise.callDone(answer);
		readLine.close();
	});

	return promise;
};

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	question,
};
