/**
 * This source code is licensed under the terms found in the LICENSE file in 
 * the root directory of this project.
 */

/******************************************************************************
 * Consts
 *****************************************************************************/
const MAC_EPOCH_DELTA = 978307200;

/**
 *
 *
 * @param {number} time
 * @returns {number}
 */
const timeToAppleTime = function timeToAppleTime(time) {
	return (time / 1000) - MAC_EPOCH_DELTA;
};

/**
 *
 *
 * @returns {number}
 */
const getTimeWithAppleEpoch = function getTimeWithAppleEpoch() {
	return timeToAppleTime(Date.now());
};

/**
 *
 *
 * @param {Date} date
 * @returns {Date}
 */
const dateToAppleDate = function dateToAppleDate(date) {
	return new Date(getTimeWithAppleEpoch(date.getTime()));
};

/**
 *
 *
 * @param {number} appleTime
 * @returns {Date}
 */
const appleTimeToDate = function appleTimeToDate(appleTime) {
	return new Date((MAC_EPOCH_DELTA + appleTime) * 1000);
};

/******************************************************************************
 * Exports
 *****************************************************************************/
module.exports = {
	timeToAppleTime,
	getTimeWithAppleEpoch,
	dateToAppleDate,
	appleTimeToDate,
};
