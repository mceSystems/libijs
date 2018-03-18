/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const NumberSizes = require("./format").numberSizes;

// For writeUInt64BE/writeInt64BE
const ref = require("ref");

/******************************************************************************
 * Consts
 *****************************************************************************/
const UINT8_SIZE = NumberSizes.uint8.bytes;
const UINT16_SIZE = NumberSizes.uint16.bytes;
const UINT32_SIZE = NumberSizes.uint32.bytes;
const INT64_SIZE = NumberSizes.int64.bytes;
const DOUBLE_SIZE = NumberSizes.double.bytes;

/******************************************************************************
 * Classes
 *****************************************************************************/
/**
 *
 *
 * @class WriterBuffer
 */
class WriterBuffer {
	/**
	 * Creates an instance of WriterBuffer.
	 *
	 * @param {number} [initialSize=1024]
	 * @param {number} [scaleFactor=2]
	 *
	 * @memberof WriterBuffer
	 */
	constructor(initialSize = 1024, scaleFactor = 2) {
		this.__buffer = Buffer.allocUnsafe(initialSize);
		this.__scaleFactor = scaleFactor;
		this.__currentOffset = 0;
		this.__spaceLeft = this.__buffer.length;
	}

	/**
	 *
	 *
	 * @readonly
	 *
	 * @memberof WriterBuffer
	 */
	get offset() {
		return this.__currentOffset;
	}

	/**
	 *
	 *
	 * @readonly
	 *
	 * @memberof WriterBuffer
	 */
	get buffer() {
		return this.__buffer;
	}

	/**
	 *
	 *
	 * @param {Buffer} buffer
	 *
	 * @memberof WriterBuffer
	 */
	write(buffer) {
		const offset = this.__getRoomForData(buffer.length);
		return buffer.copy(this.__buffer, offset);
	}

	/**
	 *
	 *
	 * @param {number} value
	 * @returns {number} - UINT8_SIZE
	 *
	 * @memberof WriterBuffer
	 */
	writeUInt8(value) {
		const offset = this.__getRoomForData(UINT8_SIZE);
		this.__buffer.writeUInt8(value, offset);
		return UINT8_SIZE;
	}

	/**
	 *
	 *
	 * @param {number} value
	 * @returns {number} - UINT16_SIZE
	 *
	 * @memberof WriterBuffer
	 */
	writeUInt16(value) {
		const offset = this.__getRoomForData(UINT16_SIZE);
		this.__buffer.writeUInt16BE(value, offset);
		return UINT16_SIZE;
	}

	/**
	 *
	 *
	 * @param {number} value
	 * @returns {number} - UINT32_SIZE
	 *
	 * @memberof WriterBuffer
	 */
	writeUInt32(value) {
		const offset = this.__getRoomForData(UINT32_SIZE);
		this.__buffer.writeUInt32BE(value, offset);
		return UINT32_SIZE;
	}

	/**
	 *
	 *
	 * @param {number} value
	 * @returns {number} - INT64_SIZE
	 *
	 * @memberof WriterBuffer
	 */
	writeUInt64(value) {
		const offset = this.__getRoomForData(INT64_SIZE);
		this.__buffer.writeUInt64BE(value, offset);
		return INT64_SIZE;
	}

	/**
	 *
	 *
	 * @param {number} value
	 * @returns {number} - INT64_SIZE
	 *
	 * @memberof WriterBuffer
	 */
	writeInt64(value) {
		const offset = this.__getRoomForData(INT64_SIZE);
		this.__buffer.writeInt64BE(value, offset);
		return INT64_SIZE;
	}

	/**
	 *
	 *
	 * @param {number} value
	 * @returns {number} - DOUBLE_SIZE
	 *
	 * @memberof WriterBuffer
	 */
	writeDouble(value) {
		const offset = this.__getRoomForData(DOUBLE_SIZE);
		this.__buffer.writeDoubleBE(value, offset);
		return DOUBLE_SIZE;
	}

	/**
	 *
	 *
	 * @param {number} bytes
	 *
	 * @memberof WriterBuffer
	 */
	__getRoomForData(bytes) {
		if (this.__spaceLeft < bytes) {
			let newBufferSize = this.__buffer.length * this.__scaleFactor;
			while ((newBufferSize - this.__currentOffset) <= bytes) {
				newBufferSize *= this.__scaleFactor;
			}

			const newBuffer = Buffer.allocUnsafe(newBufferSize);
			this.__buffer.copy(newBuffer);
			this.__buffer = newBuffer;

			this.__spaceLeft = this.__buffer.length - this.__currentOffset - bytes;
		} else {
			this.__spaceLeft -= bytes;
		}

		const currentOffset = this.__currentOffset;
		this.__currentOffset += bytes;

		return currentOffset;
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = WriterBuffer;
