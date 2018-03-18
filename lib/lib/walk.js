/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
// mce Modules
const JarvisEmitter = require("jarvis-emitter");

// External Modules
const path = require("path");
const fs = require("fs");

/**
 * Directory walker, inspired by node-klaw
 *
 * @class Walker
 * @extends {JarvisEmitter}
 */
class Walker extends JarvisEmitter {
	/**
	 * Creates an instance of Walker.
	 *
	 * @param {string} dir
	 * @param {boolean} directoriesAsItems
	 * @param {boolean} recursive
	 *
	 * @memberof Walker
	 */
	constructor(dir, directoriesAsItems, recursive) {
		super();

		this.extend([
			JarvisEmitter
                .interfaceProperty()
                .name("item")
                .role(JarvisEmitter.role.event)
                .description("Triggered for each traversed file/dir")
                .build(),
		]);

		this.__directoriesAsItems = directoriesAsItems;

		this.__pendingItemsCount = 1;
		this.__walkDir = this.__walkDir.bind(this);
		this.__walkDir(path.resolve(dir).replace(/\\/g, "/"), "", recursive);
	}

	/**
	 *
	 *
	 * @param {string} dirFullPath
	 * @param {string} dirRelativePath
	 * @param {boolean} recursive
	 *
	 * @memberof Walker
	 */
	__walkDir(dirFullPath, dirRelativePath, recursive) {
		fs.readdir(dirFullPath, (err, files) => {
			for (const file of files) {
				this.__handleItem(dirFullPath, dirRelativePath, file, recursive);
			}

			this.__pendingItemsCount--;
			if (0 === this.__pendingItemsCount) {
				this.callDone(true);
			}
		});
	}

	/**
	 *
	 *
	 * @param {string} dirFullPath
	 * @param {string} dirRelativePath
	 * @param {string} itemName
	 * @param {boolean} recursive
	 *
	 * @memberof Walker
	 */
	__handleItem(dirFullPath, dirRelativePath, itemName, recursive) {
		const itemFullPath = `${dirFullPath}/${itemName}`;

		const itemInfo = {
			name: itemName,
			fullPath: itemFullPath,
			relativeToRoot: dirRelativePath ? `${dirRelativePath}/${itemName}` : itemName,
		};

		this.__pendingItemsCount++;
		fs.lstat(itemFullPath, (err, stats) => {
			// TODO: Handle err

			itemInfo.stats = stats;
			if (stats.isDirectory()) {
				if (this.__directoriesAsItems) {
					this.callItem(itemInfo);
				}

				if (recursive) {
					this.__walkDir(itemInfo.fullPath, itemInfo.relativeToRoot, recursive);
				} else {
					this.__pendingItemsCount--;
				}
			} else {
				this.callItem(itemInfo);
				this.__pendingItemsCount--;
			}

			if (0 === this.__pendingItemsCount) {
				this.callDone(true);
			}
		});
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
/**
 *
 *
 * @param {string} dir
 * @param {boolean} [directoriesAsItems=false]
 * @param {boolean} [recursive=false]
 * @returns {Walker}
 */
module.exports = (dir, directoriesAsItems = false, recursive = false) => {
	return new Walker(dir, directoriesAsItems, recursive);
};
