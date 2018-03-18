/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const Service = require("./Service");
const plist = require("./plist");

/******************************************************************************
 * Consts
 *****************************************************************************/
const PLIST_SIZE_FIELD_SIZE = 4;

/**
 *
 *
 * @class PropertyListService
 * @extends {Service}
 */
class PropertyListService extends Service {
	/**
	 * Creates an instance of PropertyListService.
	 *
	 * @param {UsbmuxdDeviceConnection} connection
	 * @param {Service.Mode} [mode=Service.Mode.RequestResponse]
	 *
	 * @memberof PropertyListService
	 */
	constructor(connection, mode = Service.Mode.RequestResponse) {
		super(connection, PLIST_SIZE_FIELD_SIZE, mode);
	}

	/**
	 *
	 *
	 * @param {Buffer} header
	 * @returns {number}
	 *
	 * @memberof PropertyListService
	 */
	_parseHeader(header) {
		return header.readUInt32BE(0);
	}

	/**
	 *
	 *
	 * @param {Buffer} header
	 * @param {Buffer} data
	 *
	 * @memberof PropertyListService
	 */
	_buildHeader(header, data) {
		header.writeUInt32BE(data.length);
	}

	/**
	 *
	 *
	 * @param {number} header
	 * @returns {number}
	 *
	 * @memberof PropertyListService
	 */
	_getDataSizeFromHeader(header) {
		return header;
	}

	/**
	 *
	 *
	 * @param {Buffer} data
	 * @returns {any}
	 *
	 * @memberof PropertyListService
	 */
	_parseData(data) {
		return plist.parse(data);
	}

	/**
	 *
	 *
	 * @param {Object} request
	 * @param {boolean} [waitForResponse=true]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof PropertyListService
	 */
	_writeXml(request, waitForResponse = true) {
		return this._write(plist.createXml(request), false, waitForResponse);
	}

	/**
	 *
	 *
	 * @param {Object} request
	 * @param {boolean} [waitForResponse=true]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof PropertyListService
	 */
	_writeBinary(request, waitForResponse = true) {
		return this._write(plist.createBinary(request), false, waitForResponse);
	}

	/**
	 *
	 *
	 * @param {Buffer} data
	 *
	 * @memberof PropertyListService
	 */
	_writeRaw(data) {
		this._write(data, true, false);
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = PropertyListService;
