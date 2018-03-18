/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
// External Modules
const Readable = require("stream").Readable;
const Writable = require("stream").Writable;

/**
 * Implements a readable (node) stream for an AFC file
 *
 * @class AfcReadableFileStream
 * @extends {Readable}
 */
class AfcReadableFileStream extends Readable {
	/**
	 * Creates an instance of AfcReadableFileStream.
	 *
	 * @param {File} file
	 * @param {number} fileSize
	 * @param {Object} options
	 *
	 * @memberof AfcReadableFileStream
	 */
	constructor(file, fileSize, options) {
		super(options);

		this.__file = file;
		this.__fileSize = fileSize;
		this.__totalRead = 0;
		this.__stopped = false;
	}

	/**
	 *
	 *
	 * @param {number} size
	 *
	 * @memberof AfcReadableFileStream
	 */
	_read(size) {
		if (0 === this.__fileSize) {
			this.__stopReading();
			return;
		}

		this.__file.read(size)
			.done((data) => {
				if (this.__stopped) {
					return;
				}

				if (!data) {
					this.__stopReading();
					return;
				}

				// Push the data to the stream
				this.push(data);

				// End the stream if we've read the entire file
				this.__totalRead += data.length;
				if (this.__totalRead === this.__fileSize) {
					this.__stopReading();
				}
			});
	}

	/**
	 *
	 *
	 * @memberof AfcReadableFileStream
	 */
	__stopReading() {
		if (!this.__stopped) {
			// Set the "stopped" flag before calling "close", as a pending read we've already sent might return when we close the file
			this.__stopped = true;
			this.__file.close()
				.done(() => {
					this.push(null);
				});
		}
	}
}

/**
 * Implements a writable (node) stream for an AFC file
 *
 * @class AfcWritableFileStream
 * @extends {Writable}
 */
class AfcWritableFileStream extends Writable {
	/**
	 * Creates an instance of AfcWritableFileStream.
	 *
	 * @param {File} file
	 * @param {Object} options
	 *
	 * @memberof AfcWritableFileStream
	 */
	constructor(file, options) {
		super(options);

		this.__file = file;
	}

	/**
	 * @callback writeCallback
	 * @param {Error} [err=null]
	 *
	 */

	/**
	 *
	 *
	 * @param {any} chunk
	 * @param {string} encoding
	 * @param {writeCallback} callback
	 *
	 * @memberof AfcWritableFileStream
	 */
	_write(chunk, encoding, callback) {
		// TODO: encoding?
		this.__file.write(chunk)
			.done((result) => {
				if (!result) {
					callback(new Error("Failed to write to the afc file"));
				} else {
					callback();
				}
			});
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	AfcReadableFileStream,
	AfcWritableFileStream,
};
