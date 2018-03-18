/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
// mce Modules
const JarvisEmitter = require("jarvis-emitter");
const meaco = require("meaco");

// External Modules
const yauzl = require("yauzl");
const streamBuffers = require("stream-buffers");

/**
 *
 *
 * @param {yauzl.ZipFile} zipFile
 * @param {yauzl.Entry} entry
 * @returns {JarvisEmitter}
 */
const extractZipEntryToBuffer = function extractZipEntryToBuffer(zipFile, entry) {
	const promise = new JarvisEmitter();

	JarvisEmitter.emitify(zipFile.openReadStream.bind(zipFile), false)(entry)
		.done((readErr, entryReadStream) => {
			if (readErr) {
				console.log(`Failed extract '${entry.fileName}: ${readErr}`);
				promise.callError(readErr);
			}

			const extractFileStream = new streamBuffers.WritableStreamBuffer({ initialSize: entry.uncompressedSize });

			entryReadStream.on("end", () => {
				promise.callDone(extractFileStream.getContents());
			});

			entryReadStream.pipe(extractFileStream);
		});

	return promise;
};

/**
 *
 *
 * @param {string} zipPath
 * @param {Object.<string, RegExp>} files
 * @returns {JarvisEmitter}
 */
const extractFilesToBuffers = function extractFilesToBuffers(zipPath, files) {
	return meaco(function* main() {
		// Open the zip file
		const [err, zipFile] = yield JarvisEmitter.emitify(yauzl.open)(zipPath, { lazyEntries: true });
		if (err) {
			console.log(`Failed to open '${zipPath}: ${err}`);
			return yield new JarvisEmitter().callError(err);
		}

		const unzipDonePromise = new JarvisEmitter();
		const filesLeftToSearch = new Map(Object.entries(files));
		const extractedFiles = {};

		// Go through the zip file entries, downloading each requested file we encounter
		zipFile.readEntry();
		zipFile.on("entry", (entry) => {
			// Check the current entry against file patterns
			let extractFileAs = null;
			for (const [name, pattern] of filesLeftToSearch.entries()) {
				if (pattern.test(entry.fileName)) {
					extractFileAs = name;
					break;
				}
			}

			// Extract the current entry if it matched
			if (extractFileAs) {
				extractZipEntryToBuffer(zipFile, entry)
					.done((extractedFile) => {
						extractedFiles[extractFileAs] = extractedFile;

						filesLeftToSearch.delete(extractFileAs);
						if (0 === filesLeftToSearch.size) {
							unzipDonePromise.callDone();
						} else {
							zipFile.readEntry();
						}
					})
					.error((err) => {
						unzipDonePromise.callError(err);
					});
				// Or move on to the next entry
			} else {
				zipFile.readEntry();
			}
		});
		zipFile.on("end", () => {
			unzipDonePromise.callDone();
		});

		// Wait for all files to be extracted
		yield unzipDonePromise;

		return extractedFiles;
	});
};

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	extractFilesToBuffers,
};
