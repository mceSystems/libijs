/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

 // TODO: Explose UID and Real from bplist, share with xml plist?

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const bplistWriter = require("./bplist/Writer").write;
const bplistReader = require("./bplist/Reader");

// mce Modules
const JarvisEmitter = require("jarvis-emitter");

// External Modules
const plist = require("plist-native");
const fs = require("fs");

/**
 *
 *
 * @param {Buffer} buffer
 */
const parse = function parse(buffer) {
	if (bplistReader.isBinaryPlist(buffer)) {
		return bplistReader.read(buffer);
	}

	return plist.parse(buffer);
};

/**
 *
 *
 * @param {string} filePath
 * @returns {JarvisEmitter}
 */
const readFile = function readFile(filePath) {
	return JarvisEmitter.emitify(fs.readFile, false)(filePath)
		.done.middleware((next, err, data) => {
			next(err ? null : parse(data));
		});
};

/**
 *
 *
 * @param {any} obj
 * @returns {Buffer|string}
 */
const createXml = function createXml(obj, asString = true) {
	return asString ? plist.buildString(obj) : plist.build(obj);
};

/**
 *
 *
 * @param {any} obj
 * @returns {Buffer}
 */
const createBinary = function createBinary(obj) {
	return bplistWriter(obj);
};

/**
 *
 *
 * @param {any} obj
 * @param {string} filePath
 * @param {Object} [fileOptions=null]
 * @returns {JarvisEmitter}
 */
const writeXmlFile = function writeXmlFile(obj, filePath, fileOptions = null) {
	return JarvisEmitter.emitify(fs.writeFile, false)(filePath, plist.build(obj), fileOptions);
};

/**
 *
 *
 * @param {any} obj
 * @param {string} filePath
 * @param {Object} [fileOptions=null]
 * @returns {JarvisEmitter}
 */
const writeBinaryFile = function writeBinaryFile(obj, filePath, fileOptions = null) {
	return JarvisEmitter.emitify(fs.writeFile, false)(filePath, bplistWriter(obj), fileOptions);
};

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	parse,
	readFile,
	createXml,
	createBinary,
	writeXmlFile,
	writeBinaryFile,
};
