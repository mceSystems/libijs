/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

const libijs = require("../");
const meaco = require("meaco");
const JarvisEmitter = require("jarvis-emitter");
const fs = require("fs-extra");

const AFC = libijs.services.AFC;

function printFileUsingReadableStream(afc, filePath) {
	const fileReadDone = new JarvisEmitter();

	afc.openFileAsReadableStream(filePath)
		.done((remoteFile) => {
			remoteFile.on("data", (data) => {
				process.stdout.write(data.toString());
			})
			.on("end", () => {
				fileReadDone.callDone();
			});
		});

	process.stdout.write("\n");
	return fileReadDone;
}

function testStreamApi(afc) {
	return meaco(function* doTestStreamApi() {
		// Writable file stream (ASCII art created with patorjk.com/software/taag)
		console.log("Writing a file...");
		const afcWriteStream = yield afc.openFileAsWritableStream("/testDir/test.txt");
		afcWriteStream.write(" /$$ /$$ /$$       /$$              \n");
		afcWriteStream.write("| $$|__/| $$      |__/              \n");
		afcWriteStream.write("| $$ /$$| $$$$$$$  /$$ /$$  /$$$$$$$\n");
		afcWriteStream.write("| $$| $$| $$__  $$| $$|__/ /$$_____/\n");
		afcWriteStream.write("| $$| $$| $$  \\ $$| $$ /$$|  $$$$$$ \n");
		afcWriteStream.write("| $$| $$| $$  | $$| $$| $$ \\____  $$\n");
		afcWriteStream.write("| $$| $$| $$$$$$$/| $$| $$ /$$$$$$$/\n");
		afcWriteStream.write("|__/|__/|_______/ |__/| $$|_______/ \n");
		afcWriteStream.write("                 /$$  | $$          \n");
		afcWriteStream.write("                |  $$$$$$/          \n");
		afcWriteStream.write("                 \\______/           \n");
		afcWriteStream.end();

		// Readable file stream
		console.log("Read a file using a readable stream:");
		yield printFileUsingReadableStream(afc, "/testDir/test.txt");

		// pipe streams (this is how AFC.uploadFile and AFC.downloadFile are implemented)
		const pipeLocalToRemoteDone = new JarvisEmitter();
		const afcWriteStreamForPipe = yield afc.openFileAsWritableStream("/testDir/test.js");
		fs.createReadStream(__filename)
			.pipe(afcWriteStreamForPipe)
			.on("finish", () => {
				pipeLocalToRemoteDone.callDone();
			});
		yield pipeLocalToRemoteDone;
		console.log("Uplaoded test.js");

		const pipeRemoteToLocal = new JarvisEmitter();
		const localFile = fs.createWriteStream("./testPipe.js");
		(yield afc.openFileAsReadableStream("/testDir/test.js")).pipe(localFile);
		localFile.on("finish", () => {
			pipeRemoteToLocal.callDone(true);
		});
		yield pipeRemoteToLocal;
		console.log(`Downloaded test.js (${fs.statSync("./testPipe.js").size} bytes)`);
		fs.unlinkSync("./testPipe.js");
	});
}

function testFileObject(afc) {
	return meaco(function* doTestAfc() {
		console.log("Using the File class:");
		const readableFile = yield afc.openFile("/testDir/test.txt", AFC.FileMode.r);

		console.log(`\tFile path: ${readableFile.path}`);

		// Using AFC.File.readAll
		console.log("\tRead the entire file into a buffer (with a signle read):");
		console.log((yield readableFile.readAll()).toString());

		// Using AFC.File.tell and AFC.File.seek
		console.log(`\tCurrent file position: ${yield readableFile.tell()}`);
		console.log(`\tSetting file position to 10: ${yield readableFile.seek(0, AFC.SeekOrigin.set)}`);
		console.log(`\tCurrent file position: ${yield readableFile.tell()}`);

		// Using AFC.File.read
		console.log(`\tRead next 10 bytes of the file: ${(yield readableFile.read(10)).toString()}`);
		console.log(`\tCurrent file position: ${yield readableFile.tell()}`);

		yield readableFile.close();

		const writableFile = yield afc.openFile("/testDir/testWrite.txt", AFC.FileMode.w);

		// Using AFC.File.write
		writableFile.write("Hello World!");
		writableFile.write(Buffer.alloc(10, "js"));

		// Using AFC.File.truncate and AFC.File.getInfo
		console.log(`\tFile info before: ${JSON.stringify(yield writableFile.getInfo())}`);
		console.log(`\tTruncate file to 12: ${yield writableFile.truncate(12)}`);
		console.log(`\tFile info after: ${JSON.stringify(yield writableFile.getInfo())}`);

		// Using AFC.File.lock
		console.log(`\tLock file: ${JSON.stringify(yield writableFile.lock(AFC.LockFlags.exclusive))}`);
		console.log(`\tUnlock file: ${JSON.stringify(yield writableFile.lock(AFC.LockFlags.unlock))}`);

		yield writableFile.close();
	});
}

function testAfc(device) {
	return meaco(function* doTestAfc() {
		const afc = yield libijs.services.getService(device, "afc");

		// Using AFC.getDeviceInfo
		console.log("Device info:");
		console.log(yield afc.getDeviceInfo());
		process.stdout.write("\n");

		// Using AFC.readDirectory
		console.log("Directory listing (not recursive):");
		console.log(yield afc.readDirectory("/"));
		process.stdout.write("\n");

		// Using AFC.getFileInfo
		console.log("File info:");
		console.log(yield afc.getFileInfo("DCIM/100APPLE/IMG_0003.HEIC"));
		process.stdout.write("\n");

		// Using AFC.makeDirectory, AFC.renamePath
		console.log(`Create directory: ${yield afc.makeDirectory("/testDirTemp")}`);
		console.log(`Rename path: ${yield afc.renamePath("/testDirTemp", "/testDir")}`);

		// Using AFC.downloadFile, AFC.uploadFile, AFC.removePath
		console.log(`Download a file: ${yield afc.downloadFile("DCIM/100APPLE/IMG_0003.HEIC", "./IMG_0003.HEIC")}`);
		console.log(`Upload a file: ${yield afc.uploadFile("./IMG_0003.HEIC", "/testDir/pic.HEIC")}`);
		console.log(yield afc.readDirectory("/testDir"));
		console.log(`Remove path: ${yield afc.removePath("/testDir/pic.HEIC")}`);
		console.log(yield afc.readDirectory("/testDir"));
		fs.unlinkSync("./IMG_0003.HEIC");

		// Using AFC.openFileAsWritableStream and AFC.openFileAsReadableStream
		console.log("Testing stream api");
		yield testStreamApi(afc);

		// Using AFC.readFile
		console.log("Read an entire file into a buffer (with a signle read):");
		console.log((yield afc.readFile("/testDir/test.txt")).toString());
		process.stdout.write("\n");

		// Using AFC.File class
		yield testFileObject(afc);

		fs.mkdirSync("./tmp");

		// Using AFC.downloadDir
		console.log("Downloading /testDir:");
		yield afc.downloadDir("/testDir", "./tmp")
			.fileStarted((file) => { console.log(`\tDownloading ${file}`); })
			.fileFinished((file) => { console.log(`\tDownloaded ${file}`); });

		// Using AFC.uploadDir
		console.log(`Upload dir: ${yield afc.uploadDir("./tmp", "/testDir/inner")}`);

		fs.removeSync("./tmp");

		// Using AFC.walk
		console.log("Recursive walk:");
		yield afc.walk("/testDir", true, true)
			.item((item) => { console.log(item); });

		// Using AFC.Truncate
		const sizeBefore = (yield afc.getFileInfo("/testDir/test.js")).st_size;
		if (yield afc.truncateFile("/testDir/test.js", 40)) {
			const sizeAfter = (yield afc.getFileInfo("/testDir/test.js")).st_size;
			console.log(`truncated /testDir/test.js (old size: ${sizeBefore}, new size: ${sizeAfter})`);
		} else {
			console.log("Failed to truncate file");
		}

		// Using AFC.makeLink
		// TODO: This seem to fail (at least on iPhone 6S with iOS 11.1.1)
		console.log(`Hard link: ${yield afc.makeLink(AFC.LinkType.hardLink, "/testDir/test.txt", "/testDir/test_hard.txt")}`);
		console.log(`Soft link: ${yield afc.makeLink(AFC.LinkType.symLink, "/testDir/test.txt", "/testDir/test_sym.txt")}`);

		// Using AFC.setFileTime
		// TODO: The time seem to round down in thousands (1511280610538809477 rounds down to 1511280610538809000)
		console.log(`File info before: ${JSON.stringify(yield afc.getFileInfo("/testDir/test.txt"))}`);
		console.log(`Set file time: ${yield afc.setFileTime("/testDir/test.txt", "1511280610538809477")}`);
		console.log(`File info after: ${JSON.stringify(yield afc.getFileInfo("/testDir/test.txt"))}`);

		// Using AFC.removePathAndContents
		console.log(`Remove path and contents: ${yield afc.removePathAndContents("/testDir")}`);
		console.log(yield afc.readDirectory("/"));

		// Disconnect from the AFC service and close the underlying socket
		yield afc.close();
	});
}

const deviceManager = libijs.createClient().deviceManager;
deviceManager.ready(() => {
	testAfc(deviceManager.getDevice())
	.error((e) => {
		console.log(e);
		process.exit(1);
	})
	.catch((e) => {
		console.log(e);
		process.exit(1);
	})
	.done((result) => {
		process.exit(result ? 0 : 1);
	});
});
