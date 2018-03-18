/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const PropertyListService = require("./PropertyListService");

// mce Modules
const JarvisEmitter = require("jarvis-emitter");
const meaco = require("meaco");

/******************************************************************************
 * Consts
 *****************************************************************************/
const LOCKDOWND_PORT = 0xf27e;

/**
 * Lockdownd Client
 *
 * @class Client
 * @extends {PropertyListService}
 */
class Client extends PropertyListService {
	/**
	 * Creates an instance of Client.
	 *
	 * @param {UsbmuxdClient} usbmuxdClient
	 * @param {string} udid
	 * @param {UsbmuxdDeviceConnection} connection
	 * @param {string} label
	 *
	 * @memberof Client
	 */
	constructor(usbmuxdClient, udid, connection, label) {
		super(connection);

		this.__usbmuxdClient = usbmuxdClient;
		this.__udid = udid;
		this.__label = label;
		this.__sessionId = null;
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof Client
	 */
	close() {
		return meaco(function* doClose(close) {
			let result = true;
			if (this.__sessionId) {
				result = yield this.stopSession();
			}
			yield close();
			return result;
		}.bind(this, super.close.bind(this)));
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof Client
	 */
	queryType() {
		const promise = new JarvisEmitter();

		const request = this.__createRequest("QueryType");
		this._writeXml(request)
			.done((response) => {
				promise.callDone(response.Type ? response.Type : null);
			});

		return promise;
	}

	/**
	 *
	 *
	 * @param {string} hostId
	 * @returns {JarvisEmitter}
	 *
	 * @memberof Client
	 */
	startSession(hostId) {
		return meaco(function* doStartSession() {
			// Build the "StartSession" request
			const request = this.__createRequest("StartSession");
			if (hostId) {
				request.HostID = hostId;
			}

			const systemBUID = yield this.__usbmuxdClient.readBuid();
			if (systemBUID) {
				request.SystemBUID = systemBUID;
			}

			// Send the request
			const response = yield this._writeXml(request);
			if (!this.__checkResponse(response, request)) {
				return false;
			}

			// Store our session id, which we'll need later for StopSession
			this.__sessionId = response.SessionID;

			if (response.EnableSessionSSL) {
				if (!(yield this._connection.enableSSL())) {
					return false;
				}
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @returns {JarvisEmitter}
	 *
	 * @memberof Client
	 */
	stopSession() {
		return meaco(function* doStopSession() {
			// Build the request
			const request = this.__createRequest("StopSession");
			request.SessionID = this.__sessionId;

			// Send the request
			const response = yield this._writeXml(request);
			if (!this.__checkResponse(response, request)) {
				return false;
			}

			// Disable ssl on the underlying connection if we're using ssl
			if (this.sslEnabled) {
				if (!(yield this._disableSSL())) {
					return false;
				}
			}

			return true;
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {string} service
	 * @param {boolean} sendEscrowBag
	 * @returns {JarvisEmitter}
	 *
	 * @memberof Client
	 */
	startService(service, sendEscrowBag) {
		return meaco(function* doStartService() {
			// Build the request
			const request = this.__createRequest("StartService");
			request.Service = service;

			if (sendEscrowBag) {
				const pairRecord = yield this.__usbmuxdClient.readPairRecord(this.__udid);
				request.EscrowBag = pairRecord.EscrowBag;
			}

			// Send the request
			const response = yield this._writeXml(request);
			if (!this.__checkResponse(response, request)) {
				return null;
			}

			// Return a "service descriptor" containing the service' instance information
			return {
				port: response.Port,
				sslEnabled: response.EnableServiceSSL,
			};
		}.bind(this));
	}

	/**
	 *
	 *
	 * @param {string} [domain=null]
	 * @param {string} [key=null]
	 * @returns {JarvisEmitter}
	 * @memberof Client
	 */
	getValue(domain = null, key = null) {
		const request = this.__buildValueRequest("GetValue", domain, key);
		return this.__sendAndParseResult(request, "Value");
	}

	/**
	 *
	 *
	 * @param {string} domain
	 * @param {string} key
	 * @param {any} value
	 * @returns {JarvisEmitter}
	 *
	 * @memberof Client
	 */
	setValue(domain, key, value) {
		const request = this.__buildValueRequest("SetValue", domain, key);
		request.Value = value;
		return this.__sendAndParseResult(request);
	}

	/**
	 *
	 *
	 * @param {string} domain
	 * @param {string} key
	 * @returns {JarvisEmitter}
	 *
	 * @memberof Client
	 */
	removeValue(domain, key) {
		const request = this.__buildValueRequest("RemoveValue", domain, key);
		return this.__sendAndParseResult(request);
	}

	/**
	 *
	 *
	 * @param {string} valueRequest
	 * @param {string} domain
	 * @param {string} key
	 * @returns {Object}
	 *
	 * @memberof Client
	 */
	__buildValueRequest(valueRequest, domain, key) {
		const request = this.__createRequest(valueRequest);
		if (domain) {
			request.Domain = domain;
		}
		if (key) {
			request.Key = key;
		}

		return request;
	}

	/**
	 *
	 *
	 * @param {any} request
	 * @param {any} [returnMember=null]
	 * @returns {JarvisEmitter}
	 *
	 * @memberof Client
	 */
	__sendAndParseResult(request, returnMember = null) {
		return this._writeXml(request)
			.done.middleware((next, response) => {
				if (!this.__checkResponse(response, request)) {
					return next(returnMember ? null : false);
				}

				next(returnMember ? response[returnMember] : true);
			});
	}

	/**
	 *
	 *
	 * @param {string} request
	 * @returns {Object}
	 *
	 * @memberof Client
	 */
	__createRequest(request) {
		return {
			Label: this.__label,
			Request: request,
		};
	}

	/**
	 *
	 *
	 * @param {Object} response
	 * @param {Object} requestType
	 * @returns {boolean}
	 *
	 * @memberof Client
	 */
	__checkResponse(response, request) {
		if (response.Request !== request.Request) {
			return false;
		}

		if (response.Result && ("Success" !== response.Result)) {
			return false;
		}

		return true;
	}
}

/**
 *
 *
 * @param {Device} device
 * @param {string} [label="libijs"]
 * @param {boolean} [doHandshake=true]
 * @returns
 */
const getClient = function getClient(device, label = "libijs", doHandshake = true) {
	return meaco(function* doGetClient() {
		const connection = yield device.connect(LOCKDOWND_PORT);
		if (!connection) {
			return null;
		}

		const client = new Client(device.usbmuxdClient, device.udid, connection, label);
		if (!doHandshake) {
			return client;
		}

		if ("com.apple.mobile.lockdown" !== (yield client.queryType())) {
			return null;
		}

		// TODO: ValidatePair?

		const pairRecord = yield device.usbmuxdClient.readPairRecord(device.udid);
		if (!(yield client.startSession(pairRecord.HostID))) {
			return null;
		}

		return client;
	});
};

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	port: LOCKDOWND_PORT,
	getClient,
};
