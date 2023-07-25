import Slot from "../db/models/slot";
import {getEndOfDateInUTC, getFormattedMoment, getFormattedMomentFromDB, getStartOfDateInUTC} from "./timeHelper";
import Unavailability from "../db/models/unavailabilty";
import * as _ from "lodash";

let moment = require('moment-timezone');
const SLOT_DURATION_MIN = 10
export const createSlots = () => {
    let date = moment().startOf("day")
    let slots = []
    for (let i = 0; i < 24 * 6; i++) {
        //Update the end of 00:00 manually for now to 24:00, else query will fail to get proper results
        let slot = {
            slot_id: i,
            start: date.format("HH:mm"),
            end: date.add(SLOT_DURATION_MIN, "minutes").format("HH:mm")

        }
        if (slot.end === "00:00") {
            slot.end = "24:00"
        }
        slots.push(slot)
        // console.log(JSON.stringify(slot))
    }
    // return Promise.resolve()
    return Slot.insertMany(slots)
}

/**
 * 1. Convert input times to their HH:mm counterparts preserving their own input timezone
 * 2. Convert existing slot times according to the input timezone
 * 3. Find the slots between the input start and end times and return their id as well as converted slot times
 * @param start
 * @param end
 * @param timezone
 * @returns {Promise<T | Array>} slots between the input start and end times and their id as well as converted slot times
 */
export const getSlotsInRange = (start, end, timezone = "Asia/Calcutta") => {
    /*
        NOTE1: moment.tz(..., String) does parsing in given time zone.
        If the input string contains an offset, it is used instead for parsing. The parsed moment is then converted to the target zone.
        So make sure the offset is same as the timezone sent in headers

        NOTE2: moment(...) is local mode. Ambiguous input (without offset) is assumed to be local time.
        Unambiguous input (with offset) is adjusted to local time.

        Convert input dates to formatted strings. So 2021-08-08T09:30:00.000+0530 would remain same
        with it's timezone. Then format is applied to just take out hours(24h) and minutes i.e 09:30

        Based on NOTE2, we aren't using plain moment to get hours and minutes

     */
    let startFilter = moment.tz(start, timezone).format("HH:mm")
    let endFilter = moment.tz(end, timezone).format("HH:mm")
    return Slot.find({}).sort({slot_id: 1}).then(slots => {
        let convertedSlots = []
        /*
        NOTE: moment().tz(timezone) converts given moment to the specified timezone

        In our case, the slots are saved as {"slot_id":57,"start":"09:30","end":"09:40"} where these times are assumed to be
        in server's timezone (TODO: Need to define what that is, for now assuming it to be Asia/Calcutta).
        So the function getFormattedMoment returns a moment object from the stored time values, i.e assuming the server would be running
        in aws mumbai, the timezone would be Asia/Calcutta, hence the moment(writing here the formatted version) for start would be:
        2021-08-03T09:30:00.000+0530

        Now convert it to target timezone and then get the target timezone's hour formatted string i.e 2021-08-03T09:30:00.000+0530
        and hence 09:30 for target timezone Asia/Calcutta
        If the timezone was different, this converted time would automatically be different, so its safe to use it for comparison

     */

        slots.forEach(slot => {
            let convertedSlot = {
                slot_id: slot.slot_id,
                start: getFormattedMomentFromDB(slot.start).tz(timezone).format("HH:mm"), //convert and pass back in the requested timezone format
                end: getFormattedMomentFromDB(slot.end).tz(timezone).format("HH:mm")
            }
            if (convertedSlot.end === "00:00") {
                convertedSlot.end = "24:00"
            }
            convertedSlots.push(convertedSlot)
        })
        let filtered = convertedSlots.filter((elem) => {
            return getFormattedMoment(elem.start).isBetween(getFormattedMoment(startFilter), getFormattedMoment(endFilter), null, '[)')
        })
        filtered = filtered.sort((a, b) => {
            return getFormattedMoment(a.start).diff(getFormattedMoment(b.start))
        })
        return Promise.resolve(filtered)
    }).catch(e => {
        return Promise.resolve([])
    })

}
export const getShiftSpecificSlots = (doctor, bookedSlots, momentOfDate, timezone = "Asia/Calcutta", look_ahead = false) => {
    let docAvailSlots = doctor.avail.slots
    let shift = doctor.avail.shift
    let shift1Start = shift.shift1.start
    let shift1End = shift.shift1.end
    let shift2Start = shift.shift2.start
    let shift2End = shift.shift2.end
    let isFutureDate = momentOfDate.isAfter(moment())
    let utcStart = getStartOfDateInUTC(momentOfDate, timezone)
    let utcEnd = getEndOfDateInUTC(momentOfDate, timezone)
    let response = {
        shift1: [],
        shift2: []
    }
    if (!docAvailSlots || docAvailSlots.length === 0)
        return Promise.resolve(response)

    return Slot.find({}).sort({slot_id: 1}).then(async slots => {
        let convertedSlots = []
        let dateFilter = moment()
        if (look_ahead) {
            dateFilter = dateFilter.add(10, 'minutes')
        }
        slots.forEach(slot => {
            let convertedSlot = {
                slot_id: slot.slot_id,
                start: getFormattedMomentFromDB(slot.start).tz(timezone).format("HH:mm"), //convert and pass back in the requested timezone format
                end: getFormattedMomentFromDB(slot.end).tz(timezone).format("HH:mm"),
            }
            if (convertedSlot.end === "00:00") {
                convertedSlot.end = "24:00"
            }
            //Pick only items after certain time from now
            // For testing, uncomment the code to check time passed in req
            let formattedStart = getFormattedMoment(slot.start)
            if ((isFutureDate || dateFilter.isSameOrBefore(formattedStart)) && formattedStart.isBefore(utcEnd)) {
                convertedSlots.push(convertedSlot)
            }
        })
        let manualUnavail = []
        let manualAvail = []
        await Unavailability.find({
            doctor: doctor._id,
            date: {$gte: utcStart, $lte: utcEnd}
        }).select("slot is_avail").then(results => {
            results.forEach(result => {
                if (result.is_avail)
                    manualAvail.push(result.slot)
                else {
                    manualUnavail.push(result.slot)
                }
            })
            return Promise.resolve()
        })
        convertedSlots.forEach((slot) => {
            let status = "unavailable"
            if ((docAvailSlots.includes(slot.slot_id)
                || manualAvail.includes(slot.slot_id))
                && !manualUnavail.includes(slot.slot_id))
                status = "available"
            if (bookedSlots.includes(slot.slot_id))
                status = "booked"
            let isBetweenShift1 = shift1Start !== "" && shift1End !== "" &&
                getFormattedMoment(slot.start).isBetween(getFormattedMoment(shift1Start), getFormattedMoment(shift1End), null, '[)')
            let isBetweenShift2 = shift2Start !== "" && shift2End !== "" &&
                getFormattedMoment(slot.start).isBetween(getFormattedMoment(shift2Start), getFormattedMoment(shift2End), null, '[)')
            let validShift1 = isBetweenShift1
            if (!isFutureDate)
                validShift1 = moment().isBefore(getFormattedMoment(slot.start)) && isBetweenShift1
            if (validShift1) {
                response.shift1.push({
                    ...slot,
                    is_avail: status === "available",
                    status: status
                })
            } else if (isBetweenShift2) {
                response.shift2.push({
                    ...slot,
                    is_avail: status === "available",
                    status: status
                })
            }
        })
        response.shift1.sort((a, b) => {
            return getFormattedMoment(a.start).isBefore(getFormattedMoment(b.start)) ? -1 : 1
        })
        response.shift2.sort((a, b) => {
            return getFormattedMoment(a.start).isBefore(getFormattedMoment(b.start)) ? -1 : 1
        })
        return Promise.resolve(response)
    }).catch(e => {
        return Promise.resolve(response)
    })

}
export const getDateTimeForSlot = (slot_id, date, timezone, format) => {
    let currentServerDate = moment().startOf("day")
    let momentForSlot = currentServerDate.add(slot_id * SLOT_DURATION_MIN, "minutes")

    let currentDate = moment.tz(date, format, timezone)

    momentForSlot.set({
        year: currentDate.get("year"),
        month: currentDate.get("month"),
        date: currentDate.get("date")
    })

    return momentForSlot
}

export async function updateSlotsForShift(shift, newShift, existingSlots, timezone) {
    /*
    Let's try to recreate slots here based on updated shifts

- Divide existing slots in existing shift arrays [54,55,56,57,59,60] [72,73,74,75,77,78]
- Create new shift slot arrays	[48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66] [69,70,71,72,73,74,75]
- Create common shift slot arrays [54,55,56,57,59,60]  [72,73,74,75]
- Anything in new, which is lower than lowest in old will be added 	[48,49,50,51,52,53] [69,70,71]
- Anything in new, which is greater than greatest in old will be added	[61,62,63,64,65,66] []
- Merge common,additional [48,49,50,51,52,53,54,55,56,57,59,60,61,62,63,64,65,66] [69,70,71,72,73,74,75]
    * */
    // shift = newShift
    let shift1Start = shift.shift1.start
    let shift1End = shift.shift1.end
    let shift2Start = shift.shift2.start
    let shift2End = shift.shift2.end

    let existingShiftSlots = {shift1: [], shift2: []}, newShiftSlots = {shift1: [], shift2: []},
        common = {shift1: [], shift2: []}, additional = {shift1: [], shift2: []}

    existingSlots.forEach(slot => {

        let currentServerDate = moment().startOf("day")
        let slotStart = currentServerDate.add(slot * SLOT_DURATION_MIN, "minutes").tz(timezone).format("HH:mm")
        let momentForSlot = getFormattedMoment(slotStart)
        let isBetweenShift1 = shift1Start !== "" && shift1End !== "" &&
            momentForSlot.isBetween(getFormattedMoment(shift1Start), getFormattedMoment(shift1End), null, '[)')
        if (isBetweenShift1) {
            existingShiftSlots.shift1.push(slot)
        } else {
            existingShiftSlots.shift2.push(slot)
        }

    })
    let lowS1 = _.min(existingShiftSlots.shift1)
    let lowS2 = _.min(existingShiftSlots.shift2)
    let maxS1 = _.max(existingShiftSlots.shift1)
    let maxS2 = _.max(existingShiftSlots.shift2)

    // Let's reuse same variables to play with new shift specific slots
    shift1Start = newShift.shift1.start
    shift1End = newShift.shift1.end
    shift2Start = newShift.shift2.start
    shift2End = newShift.shift2.end

    await Slot.find({}).sort({slot_id: 1, start: 1}).then(slots => {
        slots.forEach(slot => {
            let slotStart = getFormattedMomentFromDB(slot.start).tz(timezone).format("HH:mm")
            let momentForSlot = getFormattedMoment(slotStart)

            let isBetweenShift1 = shift1Start !== "" && shift1End !== "" &&
                momentForSlot.isBetween(getFormattedMoment(shift1Start), getFormattedMoment(shift1End), null, '[)')
            let isBetweenShift2 = shift2Start !== "" && shift2End !== "" &&
                momentForSlot.isBetween(getFormattedMoment(shift2Start), getFormattedMoment(shift2End), null, '[)')
            if (isBetweenShift1) {
                newShiftSlots.shift1.push(slot.slot_id)
            } else if (isBetweenShift2) {
                newShiftSlots.shift2.push(slot.slot_id)
            }
        })
    })

    common.shift1 = _.intersection(existingShiftSlots.shift1, newShiftSlots.shift1)
    common.shift2 = _.intersection(existingShiftSlots.shift2, newShiftSlots.shift2)
    additional.shift1 = _.filter(newShiftSlots.shift1, (elem) => elem < lowS1 || elem > maxS1 || !lowS1)
    additional.shift2 = _.filter(newShiftSlots.shift2, (elem) => elem < lowS2 || elem > maxS2 || !lowS2)
    return Promise.resolve(_.union(common.shift1, common.shift2, additional.shift1, additional.shift2))
}

export async function getSlotsForShift(newShift, timezone) {

    let shift1Start = newShift.shift1.start
    let shift1End = newShift.shift1.end
    let shift2Start = newShift.shift2.start
    let shift2End = newShift.shift2.end


    let slotIds = []
    await Slot.find({}).sort({slot_id: 1, start: 1}).then(slots => {
        slots.forEach(slot => {
            let slotStart = getFormattedMomentFromDB(slot.start).tz(timezone).format("HH:mm")
            let momentForSlot = getFormattedMoment(slotStart)

            let isBetweenShift1 = shift1Start !== "" && shift1End !== "" &&
                momentForSlot.isBetween(getFormattedMoment(shift1Start), getFormattedMoment(shift1End), null, '[)')
            let isBetweenShift2 = shift2Start !== "" && shift2End !== "" &&
                momentForSlot.isBetween(getFormattedMoment(shift2Start), getFormattedMoment(shift2End), null, '[)')
            if (isBetweenShift1 || isBetweenShift2) {
                slotIds.push(slot.slot_id)
            }
        })
    })

    return Promise.resolve(slotIds)
}
