import Patient from "../db/models/patient";
import {HandleError} from "./errorHandling";
import {getDateTimeFromDate, getEndOfDateInUTC, getStartOfDateInUTC, getUtcMomentForSlot} from "./timeHelper";
import {initiateRefund} from "./transactionHelper";
import Appointment from "../db/models/appointment";
import Transaction from "../db/models/transaction";
import mongoose from "mongoose";
import {initiateNotifications} from "./notificationHelper";
import Doctor from "../db/models/doctor";
import * as config from "../config/config";
import Slot from "../db/models/slot";
import {getFinalAmount, useCoupon} from "./couponHelper";
import {addByInfo} from "./modelHelper";
import {endSession} from "./sessionHelper";

const ObjectId = mongoose.Types.ObjectId;
let moment = require('moment-timezone');

export const handleCancellation = async (appointment, localUser) => {
    let patient = await Patient.findOne({user_id: localUser._id});
    let refundObj = {};
    let errorMessage
    if (patient.planned_cancellation === 3) {
        if (patient.suspended_at) {
            patient.status = 'banned';
            errorMessage = "Your account has been banned due to violation of LiveMedic terms. Please contact support."
        } else {
            patient.status = 'suspended';
            patient.suspended_at = new Date();
            errorMessage = "You've reached your maximum cancellation limit,your account has been suspended for a period of three months. Please contact support."
        }
        await endSession(localUser._id)

    }
    let transaction = await Transaction.findOne({
        appointment: appointment._id
    });
    if (appointment.status === "scheduled" && transaction) {
        let hoursTillMeeting = moment(appointment.time.utc_time).diff(moment(), 'hours')
        // let daysTillMeeting = moment(appointment.time.utc_time).diff(moment(), 'days')
        if (hoursTillMeeting < 2) {
            throw new HandleError("Sorry you are not allowed to cancel appointment 2 hours before the scheduled time.", 400)
        } else if (hoursTillMeeting >= 2 && hoursTillMeeting <= 4) {
            appointment.refund_amount = 0.5 * appointment.fee;
        } else if (hoursTillMeeting > 4) {
            appointment.refund_amount = appointment.fee;
        }
        refundObj.amount = appointment.refund_amount * 100;  // Amout in paise. The amount to be refunded (in the smallest unit of currency).
        refundObj.notes = {
            appointment: String(appointment._id),
            patient: String(localUser._id),
            cancellation_of_appointment: "Refunding for the patient due to cancellation of the appointment.",
        };
        await initiateRefund(transaction.razorpay_payment_id, refundObj);
    }

    appointment.status = "cancelled"
    appointment.updated_by = localUser._id
    appointment = await appointment.save()
    try {
        await initiateNotifications(appointment, config.constants.NOTIFICATION_TYPE.APPOINTMENT_CANCELLATION)
    } catch (e) {
        //console.log("error>>", e)
    }
    if (!errorMessage)
        patient.planned_cancellation = patient.planned_cancellation ? patient.planned_cancellation + 1 : 1
    await patient.save()
    if (errorMessage) {
        throw new HandleError(errorMessage, 400)
    }
    return Promise.resolve();
}
export const freeFollowup = async (appointment) => {
    let daysTillMeeting = moment(appointment.time.utc_time).diff(moment(), 'days')
    if (daysTillMeeting > 5)
        return Promise.resolve(false)

    let appointments = await Appointment.find({
        patient: appointment.patient,
        doctor: appointment.doctor,
    }).sort({updated_at: -1}).limit(1)
    if (appointments.length > 0) {
        /*
        It means we found a past appointment which was complete between this patient and doc,
        First check when did this appointment happen, if it was not in range of 5 days from next appointment, return false
        else check if it was a normal appointment or follow-up
         */
        let pastAppointment = appointments[0]
        if (pastAppointment.status === "completed") {
            let diffBetMeeting = moment(appointment.time.utc_time).diff(moment(pastAppointment.time.utc_time), 'days')
            if (diffBetMeeting > 5)
                return Promise.resolve(false)
            else {
                return Promise.resolve(pastAppointment.fee !== 0)
            }
        } else {
            return Promise.resolve(false)
        }

    }
    return Promise.resolve(false)

}
export const getLookupAggregateForPatient = (additionalUserProjObj = {}) => {
    return {
        $lookup: {
            from: "patients",
            let: {baseId: "$patient"},
            pipeline: [
                {$match: {$expr: {$eq: ["$_id", "$$baseId"]}},},
                {$project: {_id: 1, user_id: 1, height: 1, weight: 1}},
                {
                    $lookup: {
                        from: "users",
                        let: {userId: "$$ROOT.user_id"},
                        pipeline: [
                            {$match: {$expr: {$eq: ["$_id", "$$userId"]}},},
                            {$project: {_id: 1, first_name: 1, last_name: 1, dp: 1, dob: 1, ...additionalUserProjObj}}
                        ],
                        as: "user"
                    }
                },
                {$unwind: "$user"}
            ],
            as: "patient"
        }
    }
}

export const getLookupAggregateForCoupon = (additionalUserProjObj = {}) => {
    return {
        $lookup: {
            from: "coupons",
            let: {baseId: "$coupon"},
            pipeline: [
                {$match: {$expr: {$eq: ["$_id", "$$baseId"]}},},
                {$project: {_id: 1, code: 1, desc: 1, discount_pct: 1, coupon_type:1}},
            ],
            as: "coupon"
        }
    }
}

export const getLookupAggregateForDoctor = (baseId = "$doctor", as = "doctor", baseAsArray = false) => {
    let matchOp = "$eq"
    if (baseAsArray)
        matchOp = "$in"

    return {
        $lookup: {
            from: "doctors",
            let: {baseId: baseId},
            pipeline: [
                {$match: {$expr: {[matchOp]: ["$_id", "$$baseId"]}},},
                {$project: {_id: 1, user_id: 1, first_name: 1, last_name: 1, qualif: 1, address: 1}},
                {
                    $lookup: {
                        from: "users",
                        let: {userId: "$$ROOT.user_id"},
                        pipeline: [
                            {$match: {$expr: {$eq: ["$_id", "$$userId"]}},},
                            {$project: {_id: 1, dp: 1}}
                        ],
                        as: "user"
                    }
                },
                {$unwind: "$user"},
                {
                    $project: {
                        first_name: 1,
                        last_name: 1,
                        dp: "$user.dp",
                        exp: "$qualif.exp",
                        address: 1,
                        specialities: {
                            $map:
                                {
                                    input: "$qualif.specl",
                                    as: "specl",
                                    in: "$$specl.title"
                                }
                        },
                        fee: 1,
                        user_id:1
                    }
                }
            ],
            as: as
        }
    }
}
export const getLookupAggregateForDoctorMinimal = () => {
    return {
        $lookup: {
            from: "doctors",
            let: {baseId: "$doctor"},
            pipeline: [
                {$match: {$expr: {$eq: ["$_id", "$$baseId"]}},},
                {$project: {_id: 1, user_id: 1, first_name: 1, last_name: 1}},
                {
                    $lookup: {
                        from: "users",
                        let: {userId: "$$ROOT.user_id"},
                        pipeline: [
                            {$match: {$expr: {$eq: ["$_id", "$$userId"]}},},
                            {$project: {_id: 1, dp: 1}}
                        ],
                        as: "user"
                    }
                },
                {$unwind: "$user"}
            ],
            as: "doctor"
        }
    }
}
export const findBookedSlots = async (doctor_ids, momentOfDate, timezone, patient_id) => {
    let docSlots = {}
    let patient_match = {}
    if (patient_id) {
        patient_match = {
            $expr: {
                $cond: {
                    "if": {$eq: ["$status", "reserved"]},
                    "then": {$ne: ["$patient", patient_id]},
                    "else": true
                }
            }
        }
    }
    let utcStart = getStartOfDateInUTC(momentOfDate, timezone)
    let utcEnd = getEndOfDateInUTC(momentOfDate, timezone)
    let appointments = await Appointment.find({
        doctor: {$in: doctor_ids},
        "time.utc_time": {$gte: utcStart, $lte: utcEnd},
        status: {$in: ['scheduled', 'ongoing', 'completed', 'reserved']},
        ...patient_match
    }, {doctor: 1, time: 1})

    appointments.forEach(appointment => {
        if (docSlots[appointment.doctor._id]) {
            docSlots[appointment.doctor._id].push(appointment.time.slot_id)
        } else
            docSlots[appointment.doctor._id] = [appointment.time.slot_id]
    })


    return Promise.resolve(docSlots)
}
export const getAppointmentStats = (doctor_id) => {
    let appointment_stats = {
        "pending": 0,
        "reserved": 0,
        "completed": 0,
        "scheduled": 0,
        "ongoing": 0,
        "cancelled": 0,
    }
    return Appointment.aggregate([
        {
            $match: {doctor: ObjectId(doctor_id)}
        },
        {
            $group: {
                _id: "$status",
                count: {$sum: 1}
            }
        }
    ]).then(results => {
        results.forEach(result => {
            if (appointment_stats.hasOwnProperty(result._id))
                appointment_stats[result._id] = result.count
        })
        return Promise.resolve(appointment_stats)
    }).catch(e => {

        return Promise.resolve(appointment_stats)
    })
}

export const getPatientAppointmentStats = (patient_id) => {
    let appointment_stats = {
        "pending": 0,
        "reserved": 0,
        "completed": 0,
        "scheduled": 0,
        "ongoing": 0,
        "cancelled": 0,
    }
    return Appointment.aggregate([
        {
            $match: {patient: ObjectId(patient_id)}
        },
        {
            $group: {
                _id: "$status",
                count: {$sum: 1}
            }
        }
    ]).then(results => {
        results.forEach(result => {
            if (appointment_stats.hasOwnProperty(result._id))
                appointment_stats[result._id] = result.count
        })
        return Promise.resolve(appointment_stats)
    }).catch(e => {
        return Promise.resolve(appointment_stats)
    })
}

export const prepareAppointmentModel = async (reqBody) => {
    let {date, doctor_id, slot_id, reason, slot, complaints, code, patient_id, timezone, created_by, payment_mode} = reqBody
    let momentOfDate = getDateTimeFromDate(date, timezone)
    if (!momentOfDate.isValid()) {
        return Promise.reject("Please provide valid date")
    }

    let day = momentOfDate.format("ddd").toLowerCase()
    let key = "avail.day." + day
    let doctor = await Doctor.findOne({_id: doctor_id, [key]: true,status:"active"}, {avail: 1, qualif: 1})
    if (!doctor) {
        return Promise.reject("Doctor is not available for selected date")
    }

    let docSlots = await findBookedSlots([doctor_id], momentOfDate, timezone, patient_id)
    let slotsAlreadyBooked = docSlots[doctor._id] || []

    if (slotsAlreadyBooked.includes(slot_id))
        return Promise.reject("Doctor is not available for selected slot")
    let appointment = new Appointment()
    appointment.doctor = doctor_id
    appointment.reason = reason
    appointment.complaints = complaints
    appointment.time.slot_id = slot_id
    let slotFromDb = await Slot.findOne({slot_id: slot_id})
    appointment.time.slot = slotFromDb.start
    appointment.time.utc_time = getUtcMomentForSlot(date, slot, timezone)
    appointment.patient = patient_id
    appointment.fee = doctor.qualif.fee
    appointment.currency = doctor.qualif.currency.toUpperCase()
    appointment.payment_mode = payment_mode || "online"

    if (code && code !== "")
        try {
            await getFinalAmount(appointment.fee, code, patient_id).then(result => {
                appointment.fee = result.final_amount
                appointment.coupon = result.coupon._id
                appointment.code = code
            })
        } catch (e) {
            return Promise.reject(e)
        }
    addByInfo(appointment, created_by)

    let freeFollowUp = await freeFollowup(appointment)
    if (freeFollowUp) {
        appointment.fee = 0
        appointment.adtnl_status = "Follow Up"
    }
    if (appointment.fee == 0 || appointment.payment_mode == "cash") {
        appointment.status = "scheduled"
        if (appointment.coupon)
            await useCoupon(appointment.coupon, appointment._id, appointment.patient)
    } else {
        appointment.status = "reserved"

    }
    appointment = await appointment.save()

    if (appointment.status == "scheduled") {
        await initiateNotifications(appointment, config.constants.NOTIFICATION_TYPE.APPOINTMENT_BOOKING)
    }
    return Promise.resolve(appointment)
}
