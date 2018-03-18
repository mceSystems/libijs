/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const os = require("os");

/**
 *
 *
 * @param {number} n
 * @returns {number}
 */
const htons = function htons(n) {
	return ((n & 0xff) << 8) | ((n >> 8) & 0xff);
};

/******************************************************************************
 * Exports
 *****************************************************************************/
if ("LE" === os.endianness()) {
	module.exports = {
		htons,
	};
} else {
	module.exports = {
		htons: (n) => { return n; },
	};
}
