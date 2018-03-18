/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const bplistFormat = require("./format");
const { timeToAppleTime } = require("../../../lib/lib/appletime");

/******************************************************************************
 * Consts
 *****************************************************************************/
const NumberSizes = bplistFormat.numberSizes;
const BPlistTypes = bplistFormat.types;

const MAX_ASCII_CHAR_CODE = 127;

/******************************************************************************
 * Classes
 *****************************************************************************/
/**
 *
 *
 * @class Node
 */
class Node {
	/**
	 * @callback idWriter
	 * @param {number} id
	 */

	/**
	 * Creates an instance of Node.
	 *
	 * @param {any} [value=null]
	 *
	 * @memberof Node
	 */
	constructor(value = null) {
		this.__value = value;
	}

	/**
	 *
	 *
	 * @memberof Node
	 */
	set value(value) {
		this.__value = value;
	}

	/**
	 *
	 *
	 * @param {Buffer} buffer
	 * @param {idWriter} idWriter
	 *
	 * @memberof Node
	 */
	write(buffer, idWriter) {
		throw new Error("unknown node type");
	}

	/**
	 *
	 *
	 * @static
	 * @param {Buffer} buffer
	 * @param {nubmer} type
	 * @param {nubmer} size
	 *
	 * @memberof Node
	 */
	static _writeMarker(buffer, type, size) {
		buffer.writeUInt8(type | size.forMarker);
	}

	/**
	 *
	 *
	 * @static
	 * @param {Buffer} buffer
	 * @param {nubmer} type
	 * @param {nubmer} size
	 *
	 * @memberof Node
	 */
	static _writeIntHeader(buffer, type, size) {
		buffer.writeUInt8(type | (size < 15 ? size : 0xf));
		if (size >= 15) {
			Node._writeInteger(buffer, size);
		}
	}

	/**
	 *
	 *
	 * @static
	 * @param {Buffer} buffer
	 * @param {number} value
	 *
	 * @memberof Node
	 */
	static _writeInteger(buffer, value, type = BPlistTypes.int) {
		// 8 bytes
		if ((value < 0) || (value > 0xffffffff)) {
			Node._writeMarker(buffer, type, NumberSizes.int64);
			buffer.writeInt64(value);
		// 1 byte
		} else if (value <= 0xff) {
			Node._writeMarker(buffer, type, NumberSizes.uint8);
			buffer.writeUInt8(value);
		// 2 bytes
		} else if (value <= 0xffff) {
			Node._writeMarker(buffer, type, NumberSizes.uint16);
			buffer.writeUInt16(value);
		// 4 bytes
		} else {
			Node._writeMarker(buffer, type, NumberSizes.uint32);
			buffer.writeUInt32(value);
		}
	}
}

/**
 *
 *
 * @class ArrayNode
 * @extends {Node}
 */
class ArrayNode extends Node {
	/**
	 *
	 *
	 * @param {Buffer} buffer
	 * @param {idWriter} idWriter
	 *
	 * @memberof ArrayNode
	 */
	write(buffer, idWriter) {
		Node._writeIntHeader(buffer, BPlistTypes.array, this.__value.length);
		for (const id of this.__value) {
			idWriter(id);
		}
	}
}

/**
 *
 *
 * @class ObjectNode
 * @extends {Node}
 */
class ObjectNode extends Node {
	/**
	 *
	 *
	 * @param {Buffer} buffer
	 * @param {idWriter} idWriter
	 *
	 * @memberof ObjectNode
	 */
	write(buffer, idWriter) {
		Node._writeIntHeader(buffer, BPlistTypes.dict, this.__value.keys.length);
		for (const id of this.__value.keys) {
			idWriter(id);
		}
		for (const id of this.__value.values) {
			idWriter(id);
		}
	}
}

/**
 *
 *
 * @class DataNode
 * @extends {Node}
 */
class DataNode extends Node {
	/**
	 *
	 *
	 * @param {Buffer} buffer
	 *
	 * @memberof DataNode
	 */
	write(buffer) {
		Node._writeIntHeader(buffer, BPlistTypes.data, this.__value.length);
		buffer.write(this.__value);
	}
}

/**
 *
 *
 * @class StringNode
 * @extends {Node}
 */
class StringNode extends Node {
	/**
	 *
	 *
	 * @param {Buffer} buffer
	 *
	 * @memberof StringNode
	 */
	write(buffer) {
		if (this.__isAsciiOnly()) {
			const stringBuffer = Buffer.from(this.__value, "ascii");
			Node._writeIntHeader(buffer, BPlistTypes.asciiString, stringBuffer.length);
			buffer.write(stringBuffer);
		} else {
			// Convert our string into a big endian utf16 buffer
			const stringBuffer = Buffer.from(this.__value, "utf16le");
			stringBuffer.swap16();

			// Write our string
			Node._writeIntHeader(buffer, BPlistTypes.utf16String, stringBuffer.length);
			buffer.write(stringBuffer);
		}
	}

	/**
	 *
	 *
	 * @returns {boolean}
	 *
	 * @memberof StringNode
	 */
	__isAsciiOnly() {
		const length = this.__value.length;
		for (let i = 0; i < length; ++i) {
			if (this.__value.charCodeAt(i) > MAX_ASCII_CHAR_CODE) {
				return false;
			}
		}

		return true;
	}
}

/**
 *
 *
 * @class NumberNode
 * @extends {Node}
 */
class NumberNode extends Node {
	/**
	 * Creates an instance of NumberNode.
	 *
	 * @param {number} value
	 * @param {boolean} forceAsDouble
	 *
	 * @memberof NumberNode
	 */
	constructor(value, forceAsDouble) {
		super(value);
		this.__forceAsDouble = forceAsDouble;
	}

	/**
	 *
	 *
	 * @param {Buffer} buffer
	 *
	 * @memberof NumberNode
	 */
	write(buffer) {
		if (this.__forceAsDouble || !Number.isInteger(this.__value)) {
			Node._writeMarker(buffer, BPlistTypes.real, NumberSizes.double);
			buffer.writeDouble(this.__value);
		} else {
			Node._writeInteger(buffer, this.__value);
		}
	}
}

/**
 *
 *
 * @class BooleanNode
 * @extends {Node}
 */
class BooleanNode extends Node {
	/**
	 *
	 *
	 * @param {Buffer} buffer
	 *
	 * @memberof BooleanNode
	 */
	write(buffer) {
		Node._writeMarker(buffer, this.__value ? BPlistTypes.true : BPlistTypes.false, 0);
	}
}

/**
 *
 *
 * @class DateNode
 * @extends {Node}
 */
class DateNode extends Node {
	/**
	 *
	 *
	 * @param {Buffer} buffer
	 *
	 * @memberof DateNode
	 */
	write(buffer) {
		Node._writeMarker(buffer, BPlistTypes.date, NumberSizes.double);
		buffer.writeDouble(timeToAppleTime(this.__value));
	}
}

/**
 *
 *
 * @class UidNode
 * @extends {Node}
 */
class UidNode extends Node {
	/**
	 *
	 *
	 * @param {Buffer} buffer
	 *
	 * @memberof DateNode
	 */
	write(buffer) {
		Node._writeInteger(buffer, this.__value.value);
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	ArrayNode,
	ObjectNode,
	DataNode,
	StringNode,
	NumberNode,
	BooleanNode,
	DateNode,
	UidNode,
};
