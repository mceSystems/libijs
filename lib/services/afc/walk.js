/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
// mce Modules
const JarvisEmitter = require("jarvis-emitter");

// External modules
const path = require("path");

/**
 *
 *
 * @class AfcWalker
 * @extends {JarvisEmitter}
 */
class AfcWalker extends JarvisEmitter {
	/**
	 * Creates an instance of AfcWalker.
	 *
	 * @param {AFC} afc
	 * @param {string} remotePath
	 * @param {boolean} directoriesAsItems
	 * @param {boolean} recursive
	 *
	 * @memberof AfcWalker
	 */
	constructor(afc, remotePath, directoriesAsItems, recursive) {
		super();

		this.extend([
			JarvisEmitter
				.interfaceProperty()
				.name("item")
				.role(JarvisEmitter.role.event)
				.description("Triggered for each traversed file/dir")
				.build(),
		]);

		this.__afc = afc;
		this.__directoriesAsItems = directoriesAsItems;

		this.__pendingItemsCount = 1;
		this.__pendingPromises = [];
		this.__walkDir = this.__walkDir.bind(this);
		this.__walkDir(remotePath, "", recursive);
	}

	/**
	 *
	 *
	 * @param {string} dirFullPath
	 * @param {string} dirRelativePath
	 * @param {boolean} recursive
	 *
	 * @memberof AfcWalker
	 */
	__walkDir(dirFullPath, dirRelativePath, recursive) {
		this.__afc.readDirectory(dirFullPath)
			.done((files) => {
				for (const file of files) {
					if (("." !== file) && ".." !== (file)) {
						this.__handleItem(dirFullPath, dirRelativePath, file, recursive);
					}
				}

				this.__pendingItemsCount--;
				if (0 === this.__pendingItemsCount) {
					JarvisEmitter.all(...this.__pendingPromises).pipe(this);
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
	 * @memberof AfcWalker
	 */
	__handleItem(dirFullPath, dirRelativePath, itemName, recursive) {
		const itemFullPath = path.posix.join(dirFullPath, itemName);

		const itemInfo = {
			name: 			itemName,
			fullPath: 		itemFullPath,
			relativeToRoot: dirRelativePath ? `${dirRelativePath}/${itemName}` : itemName,
		};

		this.__pendingItemsCount++;
		this.__pendingPromises.push(this.__afc.getFileInfo(itemFullPath)
			.done((stats) => {
				stats.isDirectory = "S_IFDIR" === stats.st_ifmt;

				itemInfo.stats = stats;
				if (stats.isDirectory) {
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
					JarvisEmitter.all(...this.__pendingPromises).pipe(this);
				}
			}));
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
/**
 *
 *
 * @param {AFC} afc
 * @param {string} dir
 * @param {boolean} [directoriesAsItems=false]
 * @param {boolean} [recursive=false]
 * @returns {AfcWalker}
 */
module.exports = (afc, dir, directoriesAsItems = false, recursive = false) => {
	return new AfcWalker(afc, dir, directoriesAsItems, recursive);
};
