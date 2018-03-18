/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	code: {
		success:     0,
		errorLocal:  6,
		errorRemote: 0xb,
		fileData:    0xc,
	},

	unknownMultiDtatus: -13,

	listDirEntryType: {
		unknown:     "DLFileTypeUnknown",
		directory:   "DLFileTypeDirectory",
		regularFile: "DLFileTypeRegular",
	},
};
