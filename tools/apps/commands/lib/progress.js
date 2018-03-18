/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/**
 * 
 * 
 * @param {Object} step
 */
const renderStep = function renderStep(step) {
	let progress = step.PercentComplete || 0;
	if (!progress && ("Complete" === step.Status)) {
		// It seems that "Complete" messages doesn't have a PercentComplete property
		progress = 100;
	}

	// Create the "progress" bar (we scale everything by half (A full bar takes 50 chars)
	const completedBar = "=".repeat(progress / 2);
	const leftBar = " ".repeat(50 - completedBar.length);

	/* We'll always render the progress on the same line, so we'll move the cursor
	 * up one line, clear it and render our current progress. */
	console.log(`\x1b[1A\x1b[K${completedBar}${leftBar} ${progress}% ${step.Status}`);
};

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	renderStep,
};
