/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const ref = require("ref");
const StructType = require("ref-struct");
const ArrayType = require("ref-array");

/******************************************************************************
 * Consts and Types
 *****************************************************************************/
const MagicArray = ArrayType(ref.types.char, 8);

/******************************************************************************
 * Exports
 *****************************************************************************/
// Taken from libimobiledevice
module.exports = {
	header: {
		magic: new MagicArray(Buffer.from("CFA6LPAA")),
		Struct: StructType({
			magic: 			MagicArray,
			entireLength: 	ref.types.uint64,
			thisLength: 	ref.types.uint64,
			packetNumber: 	ref.types.uint64,
			operation: 		ref.types.uint64,
		}),
	},

	operations: {
		INVALID:                   0x00000000,	// Invalid
		STATUS:                    0x00000001,	// Status
		DATA:                      0x00000002,	// Data
		READ_DIR:                  0x00000003,	// ReadDir
		READ_FILE:                 0x00000004,	// ReadFile
		WRITE_FILE:                0x00000005,	// WriteFile
		WRITE_PART:                0x00000006,	// WritePart
		TRUNCATE:                  0x00000007,	// TruncateFile
		REMOVE_PATH:               0x00000008,	// RemovePath
		MAKE_DIR:                  0x00000009,	// MakeDir
		GET_FILE_INFO:             0x0000000A,	// GetFileInfo
		GET_DEVINFO:               0x0000000B,	// GetDeviceInfo
		WRITE_FILE_ATOM:           0x0000000C,	// WriteFileAtomic (tmp file+rename)
		FILE_OPEN:                 0x0000000D,	// FileRefOpen
		FILE_OPEN_RES:             0x0000000E,	// FileRefOpenResult
		FILE_READ:                 0x0000000F,	// FileRefRead
		FILE_WRITE:                0x00000010,	// FileRefWrite
		FILE_SEEK:                 0x00000011,	// FileRefSeek
		FILE_TELL:                 0x00000012,	// FileRefTell
		FILE_TELL_RES:             0x00000013,	// FileRefTellResult
		FILE_CLOSE:                0x00000014,	// FileRefClose
		FILE_SET_SIZE:             0x00000015,	// FileRefSetFileSize (ftruncate)
		GET_CON_INFO:              0x00000016,	// GetConnectionInfo
		SET_CON_OPTIONS:           0x00000017,	// SetConnectionOptions
		RENAME_PATH:               0x00000018,	// RenamePath
		SET_FS_BS:                 0x00000019,	// SetFSBlockSize (0x800000)
		SET_SOCKET_BS:             0x0000001A,	// SetSocketBlockSize (0x800000)
		FILE_LOCK:                 0x0000001B,	// FileRefLock
		MAKE_LINK:                 0x0000001C,	// MakeLink
		GET_FILE_HASH:             0x0000001D,	// GetFileHash
		SET_FILE_MOD_TIME:         0x0000001E,	// SetModTime
		GET_FILE_HASH_RANGE:       0x0000001F,	// GetFileHashWithRange

		// iOS 6+
		FILE_SET_IMMUTABLE_HINT:   0x00000020,	// FileRefSetImmutableHint
		GET_SIZE_OF_PATH_CONTENTS: 0x00000021,	// GetSizeOfPathContents
		REMOVE_PATH_AND_CONTENTS:  0x00000022,	// RemovePathAndContents
		DIR_OPEN:                  0x00000023,	// DirectoryEnumeratorRefOpen
		DIR_OPEN_RESULT:           0x00000024,	// DirectoryEnumeratorRefOpenResult
		DIR_READ:                  0x00000025,	// DirectoryEnumeratorRefRead
		DIR_CLOSE:                 0x00000026,	// DirectoryEnumeratorRefClose

		// iOS 7+
		FILE_READ_OFFSET:          0x00000027,	// FileRefReadWithOffset
		FILE_WRITE_OFFSET:		   0x00000028	// FileRefWriteWithOffset
	},

	error: {
		success:           0,
		unknown:           1,
		invalidHeader:     2,
		noResources:       3,
		read:              4,
		write:             5,
		unknownPacketType: 6,
		invalidArgument:   7,
		objectNotFound:    8,
		objectIsDirectory: 9,
		permissionDenied:  10,
		notConnected:      11,
		timeOut:           12,
		overrun:           13,
		EOF:               14,
		unsupported:       15,
		objecExists:       16,
		objectBusy:        17,
		noSpaceLeft:       18,
		wouldBlock:        19,
		io:                20,
		interrupted:       21,
		inProgress:        22,
		internal:          23,
	},

	fileMode: {
		r:    0x00000001, // O_RDONLY
		"r+": 0x00000002, // O_RDWR   | O_CREAT
		w:    0x00000003, // O_WRONLY | O_CREAT  | O_TRUNC
		"w+": 0x00000004, // O_RDWR   | O_CREAT  | O_TRUNC
		a:    0x00000005, // O_WRONLY | O_APPEND | O_CREAT
		"a+": 0x00000006, // O_RDWR   | O_APPEND | O_CREAT
	},

	linkType: {
		hardLink: 1,
		symLink: 2,
	},

	lockFlags: {
		shared:		1 | 4,
		exclusive:	2 | 4,
		unlock: 	8 | 4,
	},

	seekOrigin: {
		set: 0,
		cur: 1,
		end: 2,
	},

	operationsData: {
		Read: StructType({
			handle: ref.types.uint64,
			size: ref.types.uint64,
		}),
		Lock: StructType({
			handle: ref.types.uint64,
			operation: ref.types.uint64,
		}),
		Seek: StructType({
			handle: ref.types.uint64,
			whence: ref.types.uint64,
			offset: ref.types.int64,
		}),
		Truncate: StructType({
			handle: ref.types.uint64,
			newSize: ref.types.uint64,
		}),
	},
};
