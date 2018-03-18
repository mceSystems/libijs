/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

const plist = require("../lib/plist");
const meaco = require("meaco");
const fs = require("fs");

const testObject = {
	test1: 123,
	test2: "hello",
	myObj: {
		sub1: 1.3,
		sub2: [1, 2, 3],
	},
	myArr: ["item1", new Date()],
	secondString: "hello",
};

// XML plist, return as a string
console.log(plist.createXml(testObject));

// XML plist, return as a buffer
const xmlBuffer = plist.createXml(testObject, false);
console.log(plist.parse(xmlBuffer));

// Binary plist
const bplistBuffer = plist.createBinary(testObject);
console.log(plist.parse(bplistBuffer));

meaco(function* testPlistFiles() {
	// Binary file
	yield plist.writeBinaryFile(testObject, "test.bplist");
	console.log(yield plist.readFile("test.bplist"));

	// XML file
	yield plist.writeXmlFile(testObject, "test.plist");
	console.log(yield plist.readFile("test.plist"));

	fs.unlinkSync("test.bplist");
	fs.unlinkSync("test.plist");
});
