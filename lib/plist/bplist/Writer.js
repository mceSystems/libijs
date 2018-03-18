/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Reqruied Modules
 *****************************************************************************/
const WriterBuffer = require("./WriterBuffer");
const plistFormat = require("./format");
const {	ArrayNode, ObjectNode, DataNode, StringNode, NumberNode, BooleanNode, DateNode, UidNode } = require("./node_writers");
const { Real, UID } = require("./types");

/******************************************************************************
 * Consts
 *****************************************************************************/
const NumberSizes = plistFormat.numberSizes;

const BPLIST_ROOT_INDEX = 0;

/******************************************************************************
 * Classes
 *****************************************************************************/
/**
 *
 *
 * @class Writer
 */
class Writer {
	/**
	 * Creates an instance of Writer.
	 *
	 * @memberof Writer
	 */
	constructor() {
		this.__buffer = new WriterBuffer();
		this.__stringIds = {};
		this.__nodes = [];
	}

	/**
	 *
	 *
	 * @param {any} root
	 * @returns {Buffer}
	 *
	 * @memberof Writer
	 */
	write(root) {
		// Serialize the object into a series of nodes
		this.__scan(root);

		// Adjust the size of an node's id according to the number of nodes
		const [idSize, idWriter] = this.__getWriterForNumber(this.__nodes.length);

		// Write the plist's header, indicating version "00"
		this.__buffer.write(plistFormat.magic);
		this.__buffer.write(plistFormat.version);

		// Write our nodes
		const offsets = this.__nodes.map((node) => {
			const offset = this.__buffer.offset;
			node.write(this.__buffer, idWriter);
			return offset;
		});

		// Write the offset table of the nodes
		const offsetTableOffset = this.__buffer.offset;
		const [offsetSize, offsetWriter] = this.__getWriterForNumber(offsetTableOffset);
		for (const offset of offsets) {
			offsetWriter(offset);
		}

		// Finally, write the bplist's trailer
		this.__buffer.write(plistFormat.trailer.padding);
		this.__buffer.writeUInt8(offsetSize.bytes);
		this.__buffer.writeUInt8(idSize.bytes);
		this.__buffer.writeUInt64(this.__nodes.length);
		this.__buffer.writeUInt64(BPLIST_ROOT_INDEX);
		this.__buffer.writeUInt64(offsetTableOffset);

		return this.__buffer.buffer.slice(0, this.__buffer.offset);
	}

	/**
	 *
	 *
	 * @param {any} current
	 * @returns {number} - The new node's id
	 *
	 * @memberof BPlistWriter
	 */
	__scan(current) {
		if (Array.isArray(current)) {
			return this.__scanArray(current);
		}

		if (Buffer.isBuffer(current)) {
			return this.__addNode(new DataNode(current));
		}

		switch (typeof current) {
			case "string":
				return this.__scanString(current);

			case "number":
				return this.__addNode(new NumberNode(current));

			case "boolean":
				return this.__addNode(new BooleanNode(current));

			case "object":
				return this.__scanObject(current);

			default:
				throw new Error(`Unknown node type: ${current}`);
		}
	}

	/**
	 *
	 *
	 * @param {any} arr
	 * @returns {number} - The new node's id
	 *
	 * @memberof Writer
	 */
	__scanArray(arr) {
		const node = new ArrayNode();

		// Create a node for our array before creating nodes for our items
		const nodeId = this.__addNode(node);

		// Add the array's items as nodes, storing their ids for our own node
		node.value = arr.map((item) => { return this.__scan(item); });

		return nodeId;
	}

	/**
	 *
	 *
	 * @param {string} str
	 * @returns {number} - The new node's id
	 *
	 * @memberof Writer
	 */
	__scanString(str) {
		// Check if we've already added the same string value
		const existingStringId = this.__stringIds[str];
		if (undefined !== existingStringId) {
			return existingStringId;
		}

		const newNodeId = this.__addNode(new StringNode(str));
		this.__stringIds[str] = newNodeId;

		return newNodeId;
	}

	/**
	 *
	 *
	 * @param {any} obj
	 * @returns {number} - The new node's id
	 *
	 * @memberof Writer
	 */
	__scanObject(obj) {
		if (obj instanceof Real) {
			return this.__addNode(new NumberNode(obj.value, true));
		}

		if (obj instanceof Date) {
			return this.__addNode(new DateNode(obj));
		}

		if (obj instanceof UID) {
			return this.__addNode(new UidNode(obj));
		}

		// Write the object as a dictionary
		const node = new ObjectNode();

		// We'll create a node for our array before creating entires for our items
		const nodeId = this.__addNode(node);

		/* Fist, add the objects' keys as nodes, storing their ids in our own node,
		 * then add the objects' values as nodes (storing their ids in our own node) */
		const objectKeys = Object.keys(obj);
		const keys = objectKeys.map((key) => { return this.__scan(key); });
		const values = objectKeys.map((key) => { return this.__scan(obj[key]); });

		node.value = { keys, values };
		return nodeId;
	}

	/**
	 * Add a new node to our node list and return it's index
	 *
	 * @param {any} node
	 * @returns {number} - The new node's id
	 *
	 * @memberof Writer
	 */
	__addNode(node) {
		return this.__nodes.push(node) - 1;
	}

	/**
	 * @callback idWriter
	 * @param {number} id
	 */

	/**
	 *
	 *
	 * @param {number} maxOffset
	 * @returns {idWriter}
	 *
	 * @memberof Writer
	 */
	__getWriterForNumber(maxOffset) {
		// 1 Byte
		if (maxOffset < 0xff) {
			return [NumberSizes.uint8, this.__buffer.writeUInt8.bind(this.__buffer)];
		}
		// 2 Bytes
		if (maxOffset < 0xffff) {
			return [NumberSizes.uint16, this.__buffer.writeUInt16.bind(this.__buffer)];
		}
		// 4 Bytes
		if (maxOffset < 0xffffffff) {
			return [NumberSizes.uint32, this.__buffer.writeUInt32.bind(this.__buffer)];
		}
		// 8 Bytes
		return [NumberSizes.uint64, this.__buffer.writeUInt64.bind(this.__buffer)];
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	Real,
	UID,
	write: (obj) => { return new Writer().write(obj); },
};
