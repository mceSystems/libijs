/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/**
 * A "replacer" JSON.stringify which convert buffers to their base64 representation
 *
 * @param {any} result
 */
const bufferReplacer = function doBufferReplace(key, value) {
	if ((value instanceof Object) && ("Buffer" === value.type)) {
		return Buffer.from(value).toString("base64");
	}

	return value;
};

/******************************************************************************
 * Exports
 *****************************************************************************/
/**
 *
 *
 * @param {any} obj
 */
module.exports = function printObject(obj) {
	console.log(JSON.stringify(obj, bufferReplacer, 4));
};
