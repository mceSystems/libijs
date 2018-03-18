# libijs 
A node.js library for communicating with iOS devices over USB.

This is a pure javascript implementation of [libimobiledevice](https://github.com/libimobiledevice/libimobiledevice), implementing everything needed for communicating with iOS device services through usbmuxd (the dameon\service responsible for communication with iOS devices over USB).
Our goal is to evantually provide most of libimobiledevice's functionality, in an API suitable for node.js.

**Note that libijs is still an early proof of concept, and is not ready for production yet.**

## Features
* Provides a convenient node.js API for communicating with iOS devices and their services over usbmuxd.
* Provides base classes for implementing more services, like the *PropertyListService* class.
* Implements several ready to use command line tools.

## Current status
* **usbmux (client)**: All known functionality is implemented
* **lockdownd**:
	* Implemented commands:
		* QueryType
		* StartSession\StopSession
		* StartService
		* GetValue\SetValue\RemoveValue
	* Pairing, which is handled by usbmuxd, is not implemented (yet).
* Implemented Services:
	* **afc:**
		* Multiplexes requests over a single connection to the afc service. Combined with node's async nature, this introduces a major performance improvment over libimobiledevice's afc client.
		* Provides a convient native interface:
			* node.js stream interface for reading\writing remote files
			* Walking remote dirs
	* **diagnostics_relay**
	* **installation_proxy**
	* **MCInstall**
	* **mobileactivationd**
	* **mobilebackup2**
	* **notification_proxy**
	* **springboardservices**
	* **syslog_relay**
* Tools:
	*  **apps**: similar to ideviceinstaller. Currently supports listing, installing (excluding ipcc) and uninstalling apps
	*  **backup**: similar to libimobiledevice's idevicebackup2.c, currently supports only backup & restore operations
	*  **diagnostics**: similar to libimobiledevice's idevicediagnostics
	*  **info**: similar to libimobiledevice's ideviceinfo
	*  **syslog**: similar to libimobiledevice's idevicesyslog

## Installation
Simply install using npm\yarn:
```
npm install libijs
```
or
```
yarn add libijs
```

## Implementation Details
* The deviceManager uses one permanent usbmuxd connection for device listing and monitoring. Thus, the deviceManager will always maintain an updated list of connected devices, reducing the overhead of querying usbmuxd each time a device list is needed.
* AFC implementation uses the "packet number" to track requests\responses, enabling it to send multiple requests simultaneously. For example, when downloading a remote folder, "download file" requests are sent while "walking" the remote folder, which seems to greatly improve performance.
* We use our own implementations for the usbmux client and binary plist handling.
* Instead of using Promises and EventEmitters, we use our internal [JarvisEmitter](https://github.com/mceSystems/jarvis-emitter).

## Usage\API examples
TODO

### Examples
* Connect to lockdownd and query a value:
	```javascript
	const libijs = require("libijs");
	const meaco = require("meaco");
	
	const udid = ...;
	
	const queryDeviceVersion = function queryDevice(device) {
		return meaco(function* doQueryDevice() {
			// Connect to lockdownd
			const lockdownClient = yield libijs.lockdownd.getClient(device);
			
			// Query the device type and iOS version
			const productType = yield lockdownClient.getValue(null, "ProductType");
			const iosVersion = yield lockdownClient.getValue(null, "ProductVersion");
			console.log(`${productType} device running iOS ${iosVersion}`);
			
			yield lockdownClient.close();
		});
	};
	
	const deviceManager = libijs.createClient().deviceManager;
	deviceManager.ready(() => {
		const device = deviceManager.getDevice(udid);
		if (device) {
			queryDeviceVersion(device);
		} else {
			console.log("Couldn't find device");
		}
	});
	```

* Download a file using the AFC stream API:
	```javascript
	const libijs = require("libijs");
	const meaco = require("meaco");
	const JarvisEmitter = require("jarvis-emitter");
	const fs = require("fs");

	const udid = ...;

	const afcExample = function afcExample(afcClient) {
		return meaco(function* doAfcExample() {
			// List a remote dir
			yield afcClient.walk("/", false, true)
				.item((item) => { console.log(`${item.relativeToRoot} - ${item.stats.st_size} bytes`); });

			// Download a file
			yield afcClient.downloadFile("DCIM/100APPLE/IMG_0001.JPG", "./IMG_0001.JPG");

			// Use the stream api to read a file
			console.log("\nVoiceMemos.plist:");
			const remoteFile = yield afcClient.openFileAsReadableStream("iTunes_Control/iTunes/VoiceMemos.plist");
			const fileReadDone = new JarvisEmitter();
			remoteFile
				.on("data", (data) => {
					console.log(data.toString());
				})
				.on("end", () => {
					fileReadDone.callDone();
				});
			yield fileReadDone;

			// Disconnect from the afcd service
			yield afcClient.close();
		});
	};

	const deviceManager = libijs.createClient().deviceManager;
	deviceManager.ready(() => {
		const device = deviceManager.getDevice();
		libijs.services.getService(device, "afc").done(afcExample);
	});
	```

# Legal
```
Refer to the LICENSE file for libijs licensing terms.
Apple, iTunes, iPhone, iPad, Apple Watch, iPod, and iPod Touch are trademarks of Apple Inc.
```