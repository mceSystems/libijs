/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Required Modules
 *****************************************************************************/
const Service = require("../Service");

/**
 *
 *
 * @class SyslogRelay
 * @extends {Service}
 */
class SyslogRelay extends Service {
	/**
	 * Creates an instance of SyslogRelay.
	 *
	 * @param {UsbmuxdDeviceConnection} connection
	 *
	 * @memberof SyslogRelay
	 */
	constructor(connection) {
		super(connection, 0, Service.Mode.RawStream);

		/* The buffers we receive from the syslog_relay contains null terminated strings
		 * (possibly more than one) */
		this.data.middleware((next, data) => {
			let curStringStart = 0;
			let curNullTerminatorPos = data.indexOf(0);
			while (-1 !== curNullTerminatorPos) {
				// Send the current string to the user
				next(data.toString("ascii", curStringStart, curNullTerminatorPos));

				// Move past the current null terminator and search for the next one
				curStringStart = curNullTerminatorPos + 1;
				curNullTerminatorPos = data.indexOf(0, curStringStart);
			}

			// If the buffer didn't end with a null terminator - send the "lefovers" to the user
			if ((curStringStart < data.length) > 0) {
				next(data.toString("ascii", curStringStart));
			}
		});
	}
}

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = SyslogRelay;
