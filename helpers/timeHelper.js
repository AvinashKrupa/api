let moment = require('moment-timezone');
const ms = require('ms');
/**
 * receives a date in localTimezone, moves the time to start of the date and then returns the utc time for same.
 * @param localDate
 * @param timeZone
 * @returns {moment.Moment | *|null}
 */
const getStartOfDateInUTC = (localDate, timeZone, format) => {
    if (!localDate) {
        return null
    }
    if (!timeZone || timeZone === "")
        timeZone = moment.tz.guess()
    let startOfDate
    if (format)
        startOfDate = moment.tz(localDate, format, timeZone).startOf('day');
    else
        startOfDate = moment.tz(localDate, timeZone).startOf('day');
    return startOfDate.utc().toDate()
}


/**
 * receives a date in localTimezone, moves the time to end of the date and then returns the utc time for same.
 * @param localDate
 * @param timeZone
 * @returns {Date} date type of object, if moment operations are needed, handle in received date object
 */
const getEndOfDateInUTC = (localDate, timeZone) => {
    if (!localDate) {
        return null
    }
    if (!timeZone || timeZone === "")
        timeZone = moment.tz.guess()
    const endOfDate = moment.tz(localDate, timeZone).endOf('day');
    return endOfDate.utc().toDate()
}

const getFormattedDate = (localDate, sourceFormat, sourceTimeZone, targetTimeZone = "UTC", targetFormat) => {
    if (!localDate) {
        return null
    }

    let momentBasedOnSourceTz = moment.tz(localDate, sourceFormat, sourceTimeZone)
    let momentForTargetTz = momentBasedOnSourceTz.tz(targetTimeZone)
    if (targetFormat)
        return momentForTargetTz.format(sourceFormat)
    return momentForTargetTz

}
const getDateTimeFromDate = (localDate, sourceTimeZone, sourceFormat = "YYYY-MM-DD") => {
    if (!localDate) {
        return null
    }

    let momentBasedOnSourceTz = moment.tz(localDate, sourceFormat, sourceTimeZone)
    let localConvertedToSourceTz = moment().tz(sourceTimeZone)
    momentBasedOnSourceTz.set({
        'hour': localConvertedToSourceTz.get('hour'),
        'minute': localConvertedToSourceTz.get('minute'),
        'second': localConvertedToSourceTz.get('second')
    });
    return momentBasedOnSourceTz

}
const getFormattedMoment = (localDate, offset, format = "HH:mm") => {
    if (!localDate) {
        return null
    }
    /* NOTE: If you know the format of an input string, you can use that to parse a moment.
    Unless you specify a time zone offset, parsing a string will create a date in the current time zone.
     */
    if (offset) {
        return moment(localDate + "" + offset, format + "Z")
    }
    return moment(localDate, format)
}
const getFormattedMomentFromDB = (localDate) => {

    return getFormattedMoment(localDate, "+00:00")
}
const getUtcMomentForSlot = (date, slot, timezone) => {
    let finalMoment = moment.tz(date + " " + slot, "YYYY-MM-DD HH:mm", timezone)
    return finalMoment.utc()
}
const getTimezonedDateFromUTC = (localDate, timezone, format = "YYYY-MM-DD") => {
    return moment.tz(localDate, "UTC").tz(timezone).format(format)
}
const getMomentForDate = (localDate, timeZone, format = "YYYY-MM-DD") => {
    if (!localDate) {
        return null
    }
    if (!timeZone || timeZone === "")
        timeZone = moment.tz.guess()
    return moment.tz(localDate, format, timeZone)

}
const addDaysToDate = (originalDate, days) => {
    if (days !== 0) {
        return new Date(originalDate.getTime() + (86400000 * days))
    } else {
        return originalDate
    }
}
const setStartAndEndDate = (model, body = {}) => {
    let timeZone = body.timeZone ? body.timeZone : null
    if (body.start_date) {
        model.start_date = getStartOfDateInUTC(body.start_date, timeZone)
    }
    if (body.end_date) {
        model.end_date = getEndOfDateInUTC(body.end_date, timeZone)
    }

}

/**
 * Converts any type of short-hand time in hours format
 * @param time
 * @returns {string}
 */
function getFormattedValueForTime(time) {
    return (time ? ms(time) / (1000 * 60 * 60) : 24) + " hours"
}

function diffOfTwoTimeInMinutes(startDateTime, endDateTime) {  
    let startTime = moment(startDateTime, 'DD-MM-YYYY HH:mm:ss');
    let endTime = moment(endDateTime, 'DD-MM-YYYY HH:mm:ss');
    let minutesDiff = endTime.diff(startTime, 'minutes');
    return minutesDiff;
}

module.exports = {
    getStartOfDateInUTC,
    getEndOfDateInUTC,
    addDaysToDate,
    setStartAndEndDate,
    getFormattedValueForTime,
    getUtcMomentForSlot,
    getFormattedDate,
    getFormattedMoment,
    getFormattedMomentFromDB,
    getDateTimeFromDate,
    getTimezonedDateFromUTC,
    getMomentForDate,
    diffOfTwoTimeInMinutes,
}
