/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/**
 * A simple wrapper for floating point numbers, forcing the value to be written
 * as a "double" to the bplist.
 *
 * @class Real
 */
class Real {
	/**
	 * Creates an instance of Real.
	 *
	 * @param {number} value
	 *
	 * @memberof Real
	 */
	constructor(value) {
		this.__value = value;
	}

	/**
	 *
	 *
	 *
	 * @memberof Real
	 */
	get value() {
		return this.__value;
	}

	/**
	 *
	 *
	 *
	 * @memberof Real
	 */
	set value(value) {
		this.__value = value;
	}
}

/**
 * A simple wrapper for uid's (which are numbers), forcing the value to be written
 * as a "uid" to the bplist.
 *
 * @class Real
 */
class UID {
	/**
	 * Creates an instance of UID.
	 *
	 * @param {number} value
	 *
	 * @memberof UID
	 */
	constructor(value) {
		this.__value = value;
	}


	/**
	 *
	 *
	 *
	 * @memberof UID
	 */
	get value() {
		return this.__value;
	}

	/**
	 *
	 *
	 *
	 * @memberof UID
	 */
	set value(value) {
		this.__value = value;
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	Real,
	UID,
};
