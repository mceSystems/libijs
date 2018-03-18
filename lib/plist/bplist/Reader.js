/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Reqruied Modules
 *****************************************************************************/
const bplistFormat = require("./format");
const { appleTimeToDate } = require("../../../lib/lib/appletime");
const { UID } = require("./types");

/******************************************************************************
 * Consts
 *****************************************************************************/
const BPlistTypes = bplistFormat.types;

const NumberSizes = bplistFormat.numberSizes;
const UINT8_SIZE = NumberSizes.uint8.bytes;
const UINT16_SIZE = NumberSizes.uint16.bytes;
const UINT32_SIZE = NumberSizes.uint32.bytes;
const INT64_SIZE = NumberSizes.int64.bytes;
const UCHAR_SIZE = UINT16_SIZE;

/**
 *
 *
 * @class Reader
 */
class Reader {
	/**
	 * Creates an instance of Reader.
	 *
	 * @param {Buffer} buffer - The buffer to parse
	 *
	 * @memberof Reader
	 */
	constructor(buffer) {
		this.__buffer = buffer;
		this.__offsetTable = [];
		this.__objectRefReader = null;
		this.__objectRefSize = 0;

		/* According to https://opensource.apple.com/source/CF/CF-1153.18/CFBinaryPList.c,
		 * 8, 16 and 32 bit integers are unsigned, while 64bit integers are signed */
		this.__integerReaders = {
			[UINT8_SIZE]:	this.__buffer.readUInt8.bind(this.__buffer),
			[UINT16_SIZE]:	this.__buffer.readUInt16BE.bind(this.__buffer),
			[UINT32_SIZE]:	this.__buffer.readUInt32BE.bind(this.__buffer),
			[INT64_SIZE]:	this.__buffer.readInt64BE.bind(this.__buffer),
		};
	}

	/**
	 * Parses a binary plist and return it's contents (starting from the root node) as a js object
	 *
	 * @returns {Object} The parsed bplist
	 *
	 * @memberof Reader
	 */
	read() {
		/* We assume the caller had already checked if the buffer contains a bplist (using isBinaryPlist),
		 * so we just need to verify it's version */
		const bufferVersionOffset = bplistFormat.magic.length;
		if (0 !== bplistFormat.version.compare(this.__buffer, bufferVersionOffset, bufferVersionOffset + bplistFormat.version.length)) {
			return null;
		}

		// Parse the trailer
		const trailer = this.__parseTrailer();
		if (!trailer) {
			return null;
		}

		// Initialize the object reference/id parsing, according to the ref/id size
		this.__objectRefReader = this.__integerReaders[trailer.objectRefSize];
		this.__objectRefSize = trailer.objectRefSize;

		// Parse the offsets table
		this.__buildOffsetTable(trailer);

		// Finally, parse our buffer recursively, starting with the root node
		return this.__parseNode(trailer.topObject);
	}

	/**
	 * Checks if a buffer contains a bplist, according to it's length and prefix.
	 *
	 * @static
	 * @param {Buffer} buffer - The buffer to check
	 * @returns true/false indicating whether the buffer contains a bplist or not
	 *
	 * @memberof Reader
	 */
	static isBinaryPlist(buffer) {
		// The buffer should at least containg a header and a trailer
		if (buffer.length < (bplistFormat.magic.length + bplistFormat.version.length + bplistFormat.trailer.size)) {
			return false;
		}

		// A bplist buffer should start with the "bplist" prefix
		return (0 === bplistFormat.magic.compare(buffer, 0, bplistFormat.magic.length));
	}

	/**
	 * Parses the trailer of a bplist (from the stored buffer)
	 *
	 * @returns {Object} The parsed trailer
	 *
	 * @memberof Reader
	 */
	__parseTrailer() {
		// Parse the trailer
		// TODO: Use consts instead of magic numbers
		const trailerStartOffset = (this.__buffer.length - bplistFormat.trailer.size) + bplistFormat.trailer.padding.length;
		const trailer = {
			offsetSize:			this.__buffer.readUInt8(trailerStartOffset),
			objectRefSize:		this.__buffer.readUInt8(trailerStartOffset + 1),
			objectCount:		this.__buffer.readUInt64BE(trailerStartOffset + 2),
			topObject:			this.__buffer.readUInt64BE(trailerStartOffset + 10),
			offsetTableOffset:	this.__buffer.readUInt64BE(trailerStartOffset + 18),
		};

		// TODO: Complete trailer validation (based on Apple's CFBinaryPList.c)
		if ((trailer.topObject >= trailer.objectCount) ||
			(trailer.objectCount < 1) 				   ||
			(trailer.objectCount >= 0xffffffff)) {
			return null;
		}

		return trailer;
	}

	/**
	 * Parses our bplist's offset table, containing the offsets of all objects/nodes in our bplist
	 * (an object ref/id is an index into the offset table).
	 *
	 * @param {Object} trailer - The trailer (parsed by __parseTrailer)
	 *
	 * @memberof Reader
	 */
	__buildOffsetTable(trailer) {
		const offsetReader = this.__integerReaders[trailer.offsetSize];

		const offsetSize = trailer.offsetSize;
		const offsetTableEnd = trailer.offsetTableOffset + (trailer.objectCount * offsetSize);
		for	(let offset = trailer.offsetTableOffset; offset < offsetTableEnd; offset += offsetSize) {
			this.__offsetTable.push(offsetReader(offset));
		}
	}

	/**
	 * Parses a bplist node, according to it's type
	 *
	 * @param {number} index - the index of the object in the offsets table (it's ref/id)
	 * @returns The contents of the node (parsed according to it's type)
	 *
	 * @memberof Reader
	 */
	__parseNode(index) {
		const offset = this.__offsetTable[index];

		const marker = this.__buffer[offset];
		const size = marker & 0x0f;
		switch (marker & 0xf0) {
			// Null and boolean
			case BPlistTypes.null:
				switch (marker) {
					case BPlistTypes.null:
						return null;
					case BPlistTypes.true:
						return true;
					case BPlistTypes.false:
						return false;
				}
				break;

			// Integers
			case BPlistTypes.int:
				return this.__integerReaders[1 << size](offset + UINT8_SIZE);

			// UID
			case BPlistTypes.uid:
				// Note: For some reason, for UID we need to add 1 to the size (according to the format)
				return new UID(this.__integerReaders[(1 << size) + 1](offset + UINT8_SIZE));

			// Double/Float
			case BPlistTypes.real:
				if (NumberSizes.double.forMarker === size) {
					return this.__buffer.readDoubleBE(offset + UINT8_SIZE);
				} else if (NumberSizes.float.forMarker === size) {
					return this.__buffer.readFloatBE(offset + UINT8_SIZE);
				}
				break;

			// Date
			case BPlistTypes.date:
				if (NumberSizes.double.forMarker === size) {
					return appleTimeToDate(this.__buffer.readDoubleBE(offset + UINT8_SIZE));
				}
				break;

			// Data
			case BPlistTypes.data:
				return this.__parseDataNode(offset, size);

			// ASCII string
			case BPlistTypes.asciiString:
				return this.__buffer.toString("ascii", ...this.__getComplexNodeBounds(offset, size));

			// utf16 (BE) string
			case BPlistTypes.utf16String:
				return this.__buffer
						.slice(...this.__getComplexNodeBounds(offset, size, UCHAR_SIZE))
						.swap16()
						.toString("utf16le");

			// Array/Set
			case BPlistTypes.array:
			case BPlistTypes.set:
				return this.__parseArrayNode(offset, size);

			// Dictionary (object)
			case BPlistTypes.dict:
				return this.__parseDictNode(offset, size);
		}

		throw new Error("Invalid value");
	}

	/**
	 *
	 *
	 * @param {number} offset
	 * @param {number} sizeFromMarker
	 * @returns {mumber[]} - An array containing two items: [<start offset>, <end offset>]
	 *
	 * @memberof Reader
	 */
	__getComplexNodeBounds(offset, sizeFromMarker, elementSize = UINT8_SIZE) {
		let nodeStart = offset + UINT8_SIZE;

		let nodeSize = sizeFromMarker;
		if (0x0f === sizeFromMarker) {
			// The size is contained in an integer node (same format as we handle in __parseNode for integers)
			const sizeMarker = this.__buffer[nodeStart];
			if (BPlistTypes.int !== (sizeMarker & 0xf0)) {
				throw new Error("Invalid value");
			}

			const sizeOfSizeNode = 1 << (sizeMarker & 0x0f);
			nodeSize = this.__integerReaders[sizeOfSizeNode](nodeStart + UINT8_SIZE);

			// Skip the "size node"
			nodeStart += UINT8_SIZE + sizeOfSizeNode;
		}

		return [nodeStart, nodeStart + (nodeSize * elementSize)];
	}

	/**
	 *
	 *
	 * @param {number} offset
	 * @param {number} sizeFromMarker
	 * @returns {Buffer}
	 *
	 * @memberof Reader
	 */
	__parseDataNode(offset, sizeFromMarker) {
		const [start, end] = this.__getComplexNodeBounds(offset, sizeFromMarker);
		const dataBuffer = Buffer.allocUnsafe(end - start);
		this.__buffer.copy(dataBuffer, 0, start, end);

		return dataBuffer;
	}

	/**
	 *
	 *
	 * @param {number} offset
	 * @param {number} sizeFromMarker
	 *
	 * @memberof Reader
	 */
	__parseArrayNode(offset, sizeFromMarker) {
		const newArray = [];

		// Cache the members we're going to access a lot
		const objectRefSize = this.__objectRefSize;
		const objectRefReader = this.__objectRefReader;

		/* An array node contains an array of references/ids of it's items,
		 * so we'll go through the array, retrieve the offset of each item and
		 * parse it */
		const [start, end] = this.__getComplexNodeBounds(offset, sizeFromMarker, objectRefSize);
		for (let currentOffset = start; currentOffset < end; currentOffset += objectRefSize) {
			newArray.push(this.__parseNode(objectRefReader(currentOffset)));
		}

		return newArray;
	}

	/**
	 *
	 *
	 * @param {number} offset
	 * @param {number} sizeFromMarker
	 * @returns {Object}
	 *
	 * @memberof Reader
	 */
	__parseDictNode(offset, sizeFromMarker) {
		const newDict = {};

		// Cache the memebers we're going to access a lot
		const objectRefSize = this.__objectRefSize;
		const objectRefReader = this.__objectRefReader;

		/* A dict basically contains two lists of references/ids: a list of it's keys, followed
		 * by their corresponding values */
		const [start, end] = this.__getComplexNodeBounds(offset, sizeFromMarker, objectRefSize * 2);
		let keyOffset = start;
		let valueOffset = start + ((end - start) / 2);
		for	(;valueOffset < end; keyOffset += objectRefSize, valueOffset += objectRefSize) {
			const key = this.__parseNode(objectRefReader(keyOffset));
			newDict[key] = this.__parseNode(objectRefReader(valueOffset));
		}

		return newDict;
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	read: (buffer) => { return new Reader(buffer).read(); },
	isBinaryPlist: Reader.isBinaryPlist,
};
