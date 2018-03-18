/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Consts
 *****************************************************************************/
const Units = {
	Files: 0,
	Bytes: 1,
};

const MEGABYTE_SIZE = 1024 * 1024;

const dataUnits = {
	label: "MB",
	sizeInBytes: MEGABYTE_SIZE,
	digitsAfterDecimalPoint: 1,
};

/**
 * Renders a progress status to the console, in the following format:
 * <Current step name ("Sending files", etc.)>
 * <Progress bar> <Percent>% <Current>/<Total> <Units>
 *
 * Total:
 * <Progress Bar> <Percent>%
 *
 * @class ProgressDisplay
 */
class ProgressDisplay {
	/**
	 * Creates an instance of ProgressDisplay.
	 *
	 * @param {number} [stepProgressAccuracy=2]
	 *
	 * @memberof ProgressDisplay
	 */
	constructor(stepProgressAccuracy = 2) {
		this.__totalProgressPercent = 0;
		this.__step = null;
		this.__stepProgressAccuracyFactor = Math.pow(10, stepProgressAccuracy);

		// Hide the console cursor
		process.stdout.write("\x1b[?25l");

		this.__render(true);
	}

	/**
	 *
	 *
	 *
	 * @memberof ProgressDisplay
	 */
	close() {
		// Show the console cursor again
		process.stdout.write("\x1b[?25h");
	}

	/**
	 *
	 *
	 * @readonly
	 * @static
	 *
	 * @memberof ProgressDisplay
	 */
	static get Units() {
		return Units;
	}

	/**
	 *
	 *
	 * @param {any} progressPercent
	 *
	 * @memberof ProgressDisplay
	 */
	updateTotalProgress(progressPercent) {
		this.__totalProgressPercent = Math.trunc(progressPercent);
		this.__render();
	}

	/**
	 *
	 *
	 * @param {any} name
	 * @param {any} units
	 * @param {any} total
	 *
	 * @memberof ProgressDisplay
	 */
	setStep(name, units, total) {
		if ((Units.Bytes === units) && total) {
			total /= dataUnits.sizeInBytes;
		}

		this.__step = {
			name,
			units,
			total,
			current: 0,
			progressPercent: 0,
		};

		this.__render(false, true);
	}

	/**
	 *
	 *
	 * @param {any} delta
	 *
	 * @memberof ProgressDisplay
	 */
	updateStepProgress(delta) {
		if (this.__step.total) {
			if (Units.Bytes === this.__step.units) {
				delta /= dataUnits.sizeInBytes;
			}

			if (delta) {
				this.__step.current = Math.min(this.__step.current + delta, this.__step.total);
				this.__step.progressPercent = Math.trunc((this.__step.current / this.__step.total) * 100);
				this.__render();
			}
		}
	}

	/**
	 * Renders the progress bar, as follows:
	 * "<Current step name ("Sending files", etc.)>
	 * <Progress bar> <Percent>% <Current>/<Total> <Units>
	 *
	 * Total:
	 * <Progress Bar> <Percent>%"
	 *
	 * Total of 5 lines (which we'll overwrite on each render)
	 *
	 * @param {boolean} [firstRender=false]
	 * @param {boolean} [stepChanged=false]
	 *
	 * @memberof ProgressDisplay
	 */
	__render(firstRender = false, stepChanged = false) {
		if (!firstRender) {
			if (stepChanged) {
				/* We need to re-render the entire "display", so we'll:
				 * 1. Move up 5 lines
				 * 2. Clear the line (for the step name)
				 * 3. print the step's name
				 * 4. Clear the next line, for the step's progress
				 *
				 * Note that there's is no need to clear the "total" progress, as
				 * we'll overwrite it with "progressing" values, thus always overwriting
				 * the previous output. */
				process.stdout.write(`\x1b[5A\x1b[K${this.__step.name}:\n\x1b[K`);
			} else {
				/* If the state hasn't change there's no need to re-render the state name's line.
				 * We just need to move the cursor 4 rows up. */
				process.stdout.write("\x1b[4A");
			}
		}

		// Render the current step's progress, or skip it if there's no current step
		if (this.__step) {
			if (this.__step.total) {
				const progressBar = this.__createBar(this.__step.progressPercent);
				console.log(`\x1b[K${progressBar} %${this.__step.progressPercent} ${this.__getDetailedStepProgress()}`);
			} else {
				console.log(`${this.__createBar(0)} %0`);
			}
		} else {
			process.stdout.write("\n\n");
		}

		// Render the "total" progress
		console.log(`\nTotal:\n${this.__createBar(this.__totalProgressPercent)} %${this.__totalProgressPercent}`);
	}

	/**
	 *
	 *
	 * @returns
	 *
	 * @memberof ProgressDisplay
	 */
	__getDetailedStepProgress() {
		if (Units.Bytes === this.__step.units) {
			const current = this.__step.current.toFixed(dataUnits.digitsAfterDecimalPoint);
			const total = this.__step.total.toFixed(dataUnits.digitsAfterDecimalPoint);
			return `${current}/${total} ${dataUnits.label}`;
		} else {
			return `${this.__step.current}/${this.__step.total} files`;
		}
	}

	/**
	 *
	 *
	 * @param {any} progressPercent
	 * @returns
	 *
	 * @memberof ProgressDisplay
	 */
	__createBar(progressPercent) {
		// We scale everything by half (A full bar takes 50 chars)
		const completedBar = "=".repeat(progressPercent / 2);
		const leftBar = " ".repeat(50 - completedBar.length);
		return `[${completedBar}${leftBar}]`;
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = ProgressDisplay;
