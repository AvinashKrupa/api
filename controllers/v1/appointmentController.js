import {translate} from "../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import Appointment from "../../db/models/appointment";
import {
    getEndOfDateInUTC,
    getFormattedMomentFromDB,
    getStartOfDateInUTC,
    getTimezonedDateFromUTC,
    getUtcMomentForSlot
} from "../../helpers/timeHelper";
import {validate} from "../../helpers/validator";
import {HandleError} from "../../helpers/errorHandling";
import {
    getLookupAggregateForDoctor,
    getLookupAggregateForDoctorMinimal,
    getLookupAggregateForPatient
} from "../../helpers/appointmentHelper";

import mongoose from 'mongoose';
import {getLookupForByTags} from "../../helpers/modelHelper";
import Slot from "../../db/models/slot";
import {getArrayFromFilterParams} from "../../helpers/controllerHelper";

import _ from 'lodash'
import {getMeetingAccessToken} from "../../helpers/sessionHelper";
import * as config from "../../config/config";
import Patient from "../../db/models/patient";
import Doctor from "../../db/models/doctor";
import {initiateRefund} from "../../helpers/transactionHelper";
import Transaction from "../../db/models/transaction";

let moment = require('moment-timezone');
const ObjectId = mongoose.Types.ObjectId;

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    Appointment.find({}).populate("patient", "user_id")
        .populate("patient.user_id", "first_name last_name")
        .populate("doctor", "first_name last_name user_id")
        .select("-cancel_reason -complaints -currency -participants -presc_url -prescription -code -additional_doc")
        .sort({created_at: 1}).then(appointments => {
        appointments = appointments.map(appointment => {
            appointment.time.slot = moment.tz(getFormattedMomentFromDB(appointment.time.slot), timezone).format("HH:mm")
            return appointment
        })
        return jsonResponse(
            res,
            appointments,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

const index2 = (req, res) => {

    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    let {sort_key = "created_at", sort_order = "asc", limit = 10, page = 1, filter} = req.body

    let skipAndLimit = []
    if (typeof limit !== 'undefined') {
        skipAndLimit = [{$skip: limit * (page - 1)},
            {$limit: limit}]
    } else {
        skipAndLimit = [{$skip: 0}]
    }

    let patientNameMatch = {}
    let docNameMatch = {}
    let matchOpts = {}
    if (filter) {

        if (filter.patient_name) {
            let regexExp = new RegExp(filter.patient_name.replace(" ", "|"), "ig")
            patientNameMatch = {"patient.user.first_name": {$regex: regexExp}}
        }
        if (filter.doc_name) {
            let regexExp = new RegExp(filter.doc_name.replace(" ", "|"), "ig")
            docNameMatch = {"doctor.first_name": {$regex: regexExp}}
        }

        if (filter.status) {
            let statusArray = getArrayFromFilterParams(filter.status, false);
            if (statusArray.length > 0)
                matchOpts = {"status": {$in: statusArray}}
        }
        if (filter.time) {

            let utcStart = getStartOfDateInUTC(filter.time.start, timezone)
            let utcEnd = getEndOfDateInUTC(filter.time.end, timezone)
            matchOpts = {...matchOpts, "time.utc_time": {$gte: utcStart, $lte: utcEnd}}
        }

    }

    return Appointment.aggregate([
        {$match: matchOpts},
        {
            ...getLookupAggregateForPatient()
        },
        {$unwind: {path: "$patient"}},
        {$match: {...patientNameMatch}},
        {
            ...getLookupAggregateForDoctorMinimal()
        },
        {$unwind: {path: "$doctor"}},
        {$match: {...docNameMatch}},
        ...getLookupForByTags(),
        {
            $project: {
                patient: {
                    first_name: "$patient.user.first_name",
                    last_name: "$patient.user.last_name",
                    _id: "$patient._id",
                    user_id: "$patient.user_id"

                },
                doctor: {
                    first_name: "$doctor.first_name",
                    last_name: "$doctor.last_name",
                    _id: "$doctor._id",
                    user_id: "$doctor.user_id"
                },
                created_by: 1,
                updated_by: 1,
                time: 1,
                status: 1,
                created_at: 1,
                updated_at: 1,
                huno_id: 1,
                consulting_type: 1,
                reason: 1,
                adtnl_status: 1,
                payment_mode: 1,
                fee: 1,
            }
        }, {
            $sort: {
                [sort_key]: sort_order === "asc" ? 1 : -1
            }
        },
        {
            $facet: {
                metadata: [{$count: "total"}],
                docs: skipAndLimit
            }
        }

    ]).then(results => {
        let result = results[0]
        let finalResult = {};
        finalResult.docs = result.docs.map(appointment => {
            appointment.time.slot = moment.tz(getFormattedMomentFromDB(appointment.time.slot), timezone).format("HH:mm")
            appointment.time.date = getTimezonedDateFromUTC(appointment.time.utc_time, timezone)
            return appointment
        })

        finalResult.total = result && result.metadata[0] ? result.metadata[0].total : 0;
        finalResult.limit = limit;
        finalResult.page = page;
        finalResult.sort_key = sort_key;
        finalResult.sort_order = sort_order;
        return jsonResponse(
            res,
            finalResult,
            translator.__("retrieve_success"),
            200
        );
    }).catch(error => errorResponse(error, res));
}

const getDetails = (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    const validations = {
        appointment_id: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {appointment_id} = req.body
            let aggregateReq = [
                {
                    $match: {_id: ObjectId(appointment_id)}
                },
                {
                    ...getLookupAggregateForPatient()
                },
                {$unwind: {path: "$patient"}},
                {
                    ...getLookupAggregateForDoctor()
                },
                {$unwind: {path: "$doctor"}},
                {
                    ...getLookupAggregateForDoctor("$additional_doc", "additional_doc", true, true)
                },
                {
                    $project: {
                        "additional_doc.qualif": 0
                    }
                }
            ]
            return Appointment.aggregate(aggregateReq).then((results) => {
                let appointment = results[0];    //Since we are matching with only 1 id
                appointment.time.slot = moment.tz(getFormattedMomentFromDB(appointment.time.slot), timezone).format("HH:mm")
                appointment.time.date = getTimezonedDateFromUTC(appointment.time.utc_time, timezone)
                if (appointment.prescription && appointment.prescription.length > 0)
                    appointment["prescription"] = [{
                        name: `Dr ${appointment.doctor.first_name} ${appointment.doctor.last_name}`,
                        url: appointment.presc_url,
                        created_at: appointment.created_at
                    }]
                return jsonResponse(
                    res,
                    appointment,
                    translator.__("retrieve_success"),
                    200
                );
            })
        }).catch((e) => {

        return errorResponse(e, res, e.code);
    });
}
const addDoctor = (req, res) => {
    const validations = {
        doctor_id: "required",
        appointment_id: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {appointment_id, doctor_id} = req.body
            return Appointment.findOneAndUpdate({_id: appointment_id, doctor: {$ne: doctor_id}}, {
                $addToSet: {"additional_doc": doctor_id},
                $set: {updated_by: res.locals.user._id}
            }, {returnDocument: true}).then((result) => {
                if (result)
                    return jsonResponse(
                        res,
                        null,
                        "Doctor added to appointment.",
                        200
                    );
                else throw new HandleError("Doctor cannot be added to appointment.", 400)
            })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}
const removeAdditionalDoctor = (req, res) => {
    const validations = {
        doctor_id: "required",
        appointment_id: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {appointment_id, doctor_id} = req.body
            return Appointment.findOneAndUpdate({_id: appointment_id}, {
                $pull: {"additional_doc": doctor_id},
                $set: {updated_by: res.locals.user._id}
            }).then((result) => {
                if (result)
                    return jsonResponse(
                        res,
                        null,
                        "Doctor removed from appointment.",
                        200
                    );
                else throw new HandleError("Doctor cannot be added to appointment.", 400)
            })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

const changeStatus = async (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        appointment_id: "required",
        status: "required"
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {status, appointment_id} = req.body
            return Appointment.findOneAndUpdate({_id: appointment_id}, [{
                $set: {
                    status: status, updated_by: res.locals.user._id,
                    refund_amount: status == "cancelled" ? "$fee" : 0
                }
            }], {new: true}).then(async result => {
                if (status == "cancelled" && result.payment_mode == "online") {
                    //Initiate refund
                    let refundObj = {}
                    refundObj.amount = result.refund_amount * 100;  // Amount in paise. The amount to be refunded (in the smallest unit of currency).
                    refundObj.notes = {
                        appointment: String(result._id),
                        patient: String(result.patient),
                        cancellation_of_appointment: "Refunding for the patient due to cancellation of the appointment.",
                    };
                    try {
                        await Transaction.findOne({appointment: result._id}).then(async transaction => {
                            if (transaction && transaction.razorpay_payment_id)
                                await initiateRefund(transaction.razorpay_payment_id, refundObj);
                        })
                    } catch (e) {
                        console.log("error>>", e)
                    }
                }
                return jsonResponse(
                    res,
                    result,
                    translator.__("update_success"),
                    200
                );
            })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
};
const rescheduleAppointment = async (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    const validations = {
        appointment_id: "required",
        slot_id: "required",
        slot: "required",
        date: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {appointment_id, slot_id, date, slot} = req.body
            let slotFromDb = await Slot.findOne({slot_id: slot_id})
            let time = {
                utc_time: getUtcMomentForSlot(date, slot, timezone),
                slot_id: slot_id,
                slot: slotFromDb.start
            }
            return Appointment.findOneAndUpdate({_id: appointment_id, status: "scheduled"}, {
                status: "scheduled",
                time: time,
                adtnl_status: "Rescheduled",
                updated_by: res.locals.user._id
            }, {new: true}).then(async result => {
                if (!result) {
                    throw new HandleError("Cannot reschedule appointment", 400)
                } else {
                    return jsonResponse(
                        res,
                        result,
                        translator.__("update_success"),
                        200
                    );
                }

            })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
};

const joinAppointment = (req, res) => {
    const validations = {
        appointment_id: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {appointment_id} = req.body
            let doctArray = getArrayFromFilterParams(res.locals.user.selected_profile_id);
            let appointment = await Appointment.findOne({
                _id: appointment_id,
                $or: [
                    {patient: res.locals.user.selected_profile_id},
                    {doctor: res.locals.user.selected_profile_id},
                    {additional_doc: {$in: doctArray}}
                ],
                status: {$in: ["scheduled", "ongoing"]}
            })

            if (!appointment) {
                throw new HandleError("Cannot join appointment.", 400)
            }
            let minutes = moment(appointment.time.utc_time).diff(moment(), 'minutes')
            if (minutes > 1) {
                throw new HandleError("Please wait till scheduled time to start appointment.", 400)
            }
            let token = await getMeetingAccessToken(appointment, res.locals.user)
            let meeting_url = process.env.MEET_URL + appointment._id + "?jwt=" + token
            if (appointment.status === "scheduled")
                appointment.status = "ongoing"
            if (!appointment.participants)
                appointment.participants = [res.locals.user.selected_profile_id]
            else if (appointment.participants.length > 0 && !appointment.participants.includes(res.locals.user.selected_profile_id)) {
                appointment.participants.push(res.locals.user.selected_profile_id)
            }
            await appointment.save()
            return jsonResponse(
                res,
                {meeting_url: meeting_url},
                "Appointment started.",
                200
            );
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
};
const canJoinAppointment = (req, res) => {
    const validations = {
        appointment_id: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {appointment_id} = req.body
            let doctArray = getArrayFromFilterParams(res.locals.user.selected_profile_id);
            let appointment = await Appointment.findOne({
                _id: appointment_id,
                $or: [
                    {patient: res.locals.user.selected_profile_id},
                    {doctor: res.locals.user.selected_profile_id},
                    {additional_doc: {$in: doctArray}}
                ],
                status: {$in: ["scheduled", "ongoing"]}
            })

            if (!appointment) {
                throw new HandleError("Cannot join appointment.", 400)
            }
            let seconds = moment(appointment.time.utc_time).diff(moment(), 'seconds')
            let message = "Please wait till scheduled time to start appointment."
            let meeting_url;
            if (seconds < 60) {
                let token = await getMeetingAccessToken(appointment, res.locals.user)
                meeting_url = process.env.MEET_URL + appointment._id + "?jwt=" + token
                message = "Appointment can be started now."
            }


            return jsonResponse(
                res,
                {meeting_url: meeting_url, seconds: seconds},
                message,
                200
            );
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
};
const endAppointment = async (req, res) => {
    const validations = {
        appointment_id: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {appointment_id} = req.body

            let appointment = await Appointment.findOne({
                _id: appointment_id,
                $or: [
                    {patient: res.locals.user.selected_profile_id},
                    {doctor: res.locals.user.selected_profile_id}
                ],
            })
            let message = "Appointment ended."
            if (!appointment) {
                throw new HandleError("Cannot end appointment", 400)
            } else if (appointment.status == "completed") {
                message = "Appointment already ended."
            }
            if (appointment.participants)
                _.remove(appointment.participants, function (participant) {
                    return participant == res.locals.user.selected_profile_id;
                });
            if (appointment.status === "ongoing") {
                appointment.status = "completed"
                await appointment.save()
            }
            switch (res.locals.user.selected_profile) {
                case config.constants.USER_TYPE_PATIENT:
                    await Patient.findOneAndUpdate({_id: res.locals.user.selected_profile_id}, {meet_token: null})

                    break
                case config.constants.USER_TYPE_DOCTOR:
                    await Doctor.findOneAndUpdate({_id: res.locals.user.selected_profile_id}, {meet_token: null})
                    break
            }

            return jsonResponse(
                res,
                null,
                message,
                200
            );
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
};

module.exports = {
    index,
    index2,
    addDoctor,
    removeAdditionalDoctor,
    getDetails,
    changeStatus,
    joinAppointment,
    endAppointment,
    canJoinAppointment,
    rescheduleAppointment
}
