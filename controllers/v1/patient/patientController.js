import {translate} from "../../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import Doctor from "../../../db/models/doctor";
import Speciality from "../../../db/models/speciality";
import Slider from "../../../db/models/slider";
import * as config from "../../../config/config";
import Appointment from "../../../db/models/appointment";
import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";
import {
    getEndOfDateInUTC,
    getFormattedMomentFromDB,
    getStartOfDateInUTC,
    getTimezonedDateFromUTC
} from "../../../helpers/timeHelper";
import {createOrder} from "../../../helpers/transactionHelper";
import Transaction from "../../../db/models/transaction";
import {getArrayFromFilterParams} from "../../../helpers/controllerHelper";
import {addByInfo, getLookupForByTags, setAttributes} from "../../../helpers/modelHelper";
import {
    getLookupAggregateForDoctor,
    handleCancellation,
    prepareAppointmentModel,
    getPatientAppointmentStats
} from "../../../helpers/appointmentHelper";
import {getConsultantAggregate} from "../../../helpers/consultantHelper";
import Patient from "../../../db/models/patient";
import {deleteFile, uploadFile} from "../../../helpers/s3FileUploadHelper";
import Report from "../../../db/models/report";
import mongoose from "mongoose";
import { async } from "regenerator-runtime";

import {createAdminLog} from "../../../helpers/adminlogHelper";
import {getDateTimeFromDate, diffOfTwoTimeInMinutes} from "../../../helpers/timeHelper";
import {findBookedSlots} from "../../../helpers/appointmentHelper";
import {getShiftSpecificSlots} from "../../../helpers/slotHelper";
import User from "../../../db/models/user";

const ObjectId = mongoose.Types.ObjectId;
let moment = require('moment-timezone');
const index = (req, res) => {
    const translator = translate(req.headers.lang);
    Patient.find({}).then( async(patients) => {
        let patientsData = [];
        for await (let patient of patients) {
            let patientObj = JSON.parse(JSON.stringify(patient));
            let appointment_stats;
            appointment_stats = await getPatientAppointmentStats(patient._id);
            patientObj.appointment_stats = appointment_stats ;
            patientsData.push(patientObj);
        }
        return jsonResponse(
            res,
            patientsData,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

const index2 = async (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    let {sort_key = "first_name", sort_order = "asc", limit, page = 1, filter} = req.body

    let skipAndLimit = []
    if (typeof limit !== 'undefined') {
        skipAndLimit = [{$skip: limit * (page - 1)},
            {$limit: limit}]
    } else {
        skipAndLimit = [{$skip: 0}]
    }

    let matchOpts = {}
    if (filter) {
        if (filter.name) {
            let regexExp = new RegExp(filter.name.replace(" ", "|"), "ig")
            let usersData = await User.find({first_name: { $regex: regexExp }}, { _id: 1 });
            usersData = usersData.map(user => {
                return user._id;
            })
            matchOpts = {...matchOpts,  "user_id": {$in: usersData}}
        }
        if (filter.mobile_number) {
            let usersData = await User.find({mobile_number: { $regex: filter.mobile_number }}, { _id: 1 });
            usersData = usersData.map(user => {
                return user._id;
            })
            matchOpts = {...matchOpts,  "user_id": {$in: usersData}}
        }

        if (filter.status) {
            let statusArray = getArrayFromFilterParams(filter.status, false);
            if (statusArray.length > 0)
                matchOpts = {...matchOpts,"status": {$in: statusArray}}
        }
    }

    return Patient.aggregate([
        {$match: matchOpts},
        {
            $lookup: {
                from: "users",
                let: {userId: "$$ROOT.user_id"},
                pipeline: [
                    {$match: {$expr: {$eq: ["$_id", "$$userId"]}},},
                    {
                        $lookup: {
                            from: 'languages',
                            localField: 'language',
                            foreignField: '_id',
                            as: 'language'

                        }
                    },
                    {$project: {_id: 1, dp: 1,email:1, mobile_number:1,country_code:1, dob:1, language:1, gender:1, first_name:1, last_name:1}}
                ],
                as: "user_id"
            }
        },
        {$unwind: "$user_id"},
        {
            $project: {
                user_id: 1,
                huno_id:1,
                med_cond:1,
                height:1,
                dimen_type:1,
                weight:1,
                other_med_cond:1,
                status: 1,
                address:1,
                relation:1,
                relative_name:1,
                notes:1,
                created_at: 1,
                updated_at: 1,
                created_by: 1,
                updated_by: 1,
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
    ]).then( async(results) => {
        let result = results[0]
        let finalResult = {};
        for await (let doc of result.docs) {
            let appointment_stats = await getPatientAppointmentStats(doc._id);
            doc.appointment_stats = appointment_stats;
        }
        finalResult.docs = result.docs
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

/**
 *
 * @param req
 * @param res
 */
const getHomeContent = async (req, res) => {
    const translator = translate(req.headers.lang);
    let specialities = await Speciality.find({enabled: true}).sort({title: 1})
    let sliders = await Slider.find({user_type: config.constants.USER_TYPE_PATIENT, enabled: true})

    return jsonResponse(
        res,
        {
            slider: sliders,
            specialities: specialities,
        },
        translator.__("retrieve_success"),
        200
    );

};
const getTopConsultants = async (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    try {
        let {sort_key = "first_name", sort_order = "asc", limit = 10, page = 1} = req.body
        req.body.filter = {
            ...req.body.filter,
            excluded_user_id: res.locals.user._id

        }
        let aggregateRequest = getConsultantAggregate(req.body)
        Doctor.aggregate([aggregateRequest])
            .then( async (results) => {
                let result = results[0]
                let finalResult = {};
                finalResult.docs = result.docs;
                for await (let doc of finalResult.docs) {
                    let resData = await __checkDoctorAvailabilityMsg(doc._id, timezone)
                    doc.next_avail_slot_time = resData.next_avail_slot_time ;
                }

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
    } catch (e) {
        return errorResponse(e, res, e.code);
    }

};

const __checkDoctorAvailabilityMsg = async(doctorData, timezone) => {
            let resData = {};
            let currentDate = new Date().toJSON().slice(0, 10);
            let momentOfDate = getDateTimeFromDate(currentDate, timezone) 
            if (!momentOfDate.isValid()) {
                throw new HandleError("Please provide valid date", 400)
            }
            let day = momentOfDate.format("ddd").toLowerCase()
            let key = "avail.day." + day
            let doctor =  await Doctor.findOne({_id: doctorData._id, [key]: true}, {avail: 1});
            let shifts = {
                shift1: [],
                shift2: []
            }
            if (doctor) {
                let patient_id = null;
                let docSlots = await findBookedSlots([doctor._id], momentOfDate, timezone, patient_id)
                let slotsAlreadyBooked = docSlots[doctor._id] || []
                let lookAhead = true;
                let shiftData ;
                shifts = await getShiftSpecificSlots(doctor, slotsAlreadyBooked, momentOfDate, timezone, lookAhead);
                shiftData = shifts.shift1.find(obj => obj.is_avail ===true);
                let utcMoment = moment.utc();
                let startDateTime = new Date( utcMoment.format());
                startDateTime = getTimezonedDateFromUTC(startDateTime, timezone, "YYYY-MM-DD HH:mm:ss");
                let endDateTime = moment(new Date()).format('YYYY-MM-DD');
                let timeData;
                if(shiftData) {
                    endDateTime = endDateTime + ' '+ shiftData.start + ':00';
                    timeData = diffOfTwoTimeInMinutes(startDateTime, endDateTime);
                    resData.next_avail_slot_time = timeData;
                } else {
                    shiftData = shifts.shift2.find(obj => obj.is_avail ===true);
                    if(shiftData) {
                        endDateTime = endDateTime + ' '+ shiftData.start + ':00';
                        timeData = diffOfTwoTimeInMinutes(startDateTime, endDateTime);
                        resData.next_avail_slot_time = timeData;
                    } else {
                        resData.next_avail_slot_time = 0;
                    }
                }
            } else {
                resData.next_avail_slot_time = 0;
            }
            return resData;          
}


const bookAppointment = async (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    const validations = {
        doctor_id: "required",
        slot_id: "required",
        date: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let appointment
            try {
                appointment = await prepareAppointmentModel({
                    ...req.body,
                    timezone: timezone,
                    patient_id: res.locals.user.selected_profile_id,
                    created_by: res.locals.user
                })
            } catch (e) {
                throw new HandleError(e, 400)
            }

            if (appointment.status == "scheduled")
                return jsonResponse(
                    res,
                    appointment,
                    translator.__("create_success"),
                    200
                )

            await Transaction.deleteOne({appointment: appointment._id, status: "initiated"})

            return createOrder({
                amount: appointment.fee * 100,
                currency: appointment.currency,
                receipt: appointment._id.toString(),
                notes:{appointment:appointment._id.toString()}
            })
                .then(async order => {
                    let transaction = new Transaction()
                    transaction.appointment = appointment._id
                    transaction.razorpay_order_id = order.id
                    addByInfo(transaction, res.locals.user)
                    transaction = await transaction.save()

                    return jsonResponse(
                        res,
                        transaction,
                        translator.__("create_success"),
                        200
                    )
                })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
};

/**
 *
 * @param req
 * @param res
 */
const getAppointments = async (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    let {sort_key = "time.utc_time", sort_order = "desc", limit = 10, page = 1, status, date, search_text} = req.body

    let skipAndLimit = []
    if (typeof limit !== 'undefined') {
        skipAndLimit = [{$skip: limit * (page - 1)},
            {$limit: limit}]
    } else {
        skipAndLimit = [{$skip: 0}]
    }

    let matchCond = {patient: res.locals.user.selected_profile_id}
    let statusArray = getArrayFromFilterParams(status, false);
    if (statusArray.length > 0) {
        matchCond = {...matchCond, status: {$in: statusArray}}
    }

    if (date && date !== "") {
        let utcStart = getStartOfDateInUTC(date, timezone)
        let utcEnd = getEndOfDateInUTC(date, timezone)
        matchCond = {...matchCond, "time.utc_time": {$gte: utcStart, $lte: utcEnd}}
    }
    let orOpts = {}
    if (search_text && search_text !== "") {
        let regexExp = new RegExp(search_text.replace(" ", "|"), "ig")
        orOpts = {
            $or: [
                {"doctor.first_name": {$regex: regexExp}},
                {"doctor.last_name": {$regex: regexExp}},
            ]
        }
    }
    return Appointment.aggregate([
        {$match: matchCond},
        {
            ...getLookupAggregateForDoctor()
        },
        {$unwind: {path: "$doctor"}},
        {$match: {...orOpts}},
        {
            $lookup: {
                from: "transactions",
                let: {baseId: "$_id"},
                pipeline: [
                    {$match: {$expr: {$eq: ["$appointment", "$$baseId"]}},},
                    {$project: {_id: 1, status: 1}},
                ],
                as: "transaction"
            }
        },
        {
            $unwind: {
                path: "$transaction",
                preserveNullAndEmptyArrays: true
            }
        },
        ...getLookupForByTags(),
        {
            $project: {
                first_name: "$doctor.first_name",
                last_name: "$doctor.last_name",
                dp: "$doctor.dp",
                doctor_id: "$doctor._id",
                exp: "$doctor.exp",
                address: "$doctor.address",
                transaction_status: "$transaction.status",
                specialities: "$doctor.specialities",
                fee: 1,
                presc_url: 1,
                created_by: 1,
                updated_by: 1,
                created_at: 1,
                updated_at: 1,
                time: 1,
                status: 1,
                complaints: 1,
                consulting_type: 1,
                cancel_reason: 1,
                huno_id: 1,
                adtnl_status:1
            }
        },
        {
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
            let diff = moment().diff(moment(appointment.time.utc_time), "minutes")
            appointment.is_joining = diff >= 5 ? false : (diff >= 0)
            return appointment
        })

        finalResult.total = result && result.metadata[0] ? result.metadata[0].total : 0;
        finalResult.limit = limit;
        finalResult.page = page;
        finalResult.sort_key = sort_key;
        finalResult.sort_order = sort_order;
        finalResult.search_text = search_text;
        return jsonResponse(
            res,
            finalResult,
            translator.__("retrieve_success"),
            200
        );
    }).catch(error => errorResponse(error, res));


};
/**
 *
 * @param req
 * @param res
 */
const getAppointmentDetails = async (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        appointment_id: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let appointment = await Appointment.findOne({_id: req.body.appointment_id})

            return jsonResponse(
                res,
                appointment,
                translator.__("retrieve_success"),
                200
            );
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

};
const cancelAppointment = async (req, res) => {
    const validations = {
        appointment_id: "required",
        cancel_reason: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {appointment_id, cancel_reason} = req.body
            let appointment = await Appointment.findOne({
                _id: appointment_id,
            })
            if (appointment) {
                let msg = "Your appointment has been cancelled."
                switch (appointment.status) {
                    case "cancelled":
                        msg = `This appointment is already ${appointment.status}.`
                        break
                    case "scheduled":
                    case "pending":
                    case "reserved":
                        appointment.cancel_reason = cancel_reason || ""
                        await handleCancellation(appointment, res.locals.user)
                        break
                    default:
                        msg = `Cannot cancel appointment with ${appointment.status} status.`
                }
                return jsonResponse(
                    res,
                    null,
                    msg,
                    200
                );
            } else {
                throw new HandleError("Invalid appointment id.", 400);
            }

        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

const changeStatus = async (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        patient_id: "required",
        status: "required"
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {status, patient_id} = req.body
            //Using to record the log for the admin who is changing the patient status.
            return Patient.findOneAndUpdate({_id: patient_id}, {
                status: status, updated_by: res.locals.user
            }, {new: true}).then( async(result) => {
                if(status == "active") {
                    let logData = {};
                    logData.user_id = res.locals.user._id;
                    logData.module_name = config.constants.LOG_MSG_MODULE_NAME.PATIENT_PROFILE
                    logData.title = config.constants.LOG_MSG_TITLE.PATIENT_PROFILE_APPROVAL;
                    logData.message = config.constants.LOG_MESSAGE.PATIENT_PROFILE_APPROVAL;
                    logData.message = logData.message.replace('{{admin}}', res.locals.user.first_name +' '+ res.locals.user.last_name);
                    logData.message = logData.message.replace('{{patient_name}}', result.user_id.first_name +' '+ result.user_id.last_name);
                    logData.record_id =  result._id;
                    await createAdminLog(logData);
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

const uploadReport = async (req, res) => {
    const translator = translate(req.headers.lang);
    if (!req.file) {
        return errorResponse("Please provide a valid file", res, 400);
    }
    const validations = {
        date: "required",
        title: "required",
        type: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            return uploadFile(req.file, "report").then(async result => {
                let model = new Report()
                setAttributes(req.body, res.locals.user, model, true)
                model.url = result.Location
                model.patient = res.locals.user.selected_profile_id
                model = await model.save()
                return jsonResponse(
                    res,
                    model,
                    translator.__("upload_success"),
                    200
                );
            })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
};
const deleteReport = async (req, res) => {
    const translator = translate(req.headers.lang);

    const validations = {
        report_id: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {report_id} = req.body
            let report = await Report.findOne({_id: report_id, patient: res.locals.user.selected_profile_id})
            if (!report) {
                throw new HandleError("Please provide valid report id", 400)
            }
            return Promise.all([deleteFile(report.url, "report"),
                Report.deleteOne({_id: report_id})]).then((results) => {
                return jsonResponse(
                    res,
                    null,
                    translator.__("delete_success"),
                    200
                );
            })

        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
};

const getPrescriptions = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        // patient_id: "required",
    };
    let {sort_key = "created_at", sort_order = "desc", limit = 10, page = 1} = req.body
    let skipAndLimit = []
    if (typeof limit !== 'undefined') {
        skipAndLimit = [{$skip: limit * (page - 1)},
            {$limit: limit}]
    } else {
        skipAndLimit = [{$skip: 0}]
    }


    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {patient_id, status = "completed"} = req.body
            if (!patient_id)
                patient_id = res.locals.user.selected_profile_id
            let matchCond = {patient: ObjectId(patient_id), status: status, presc_url: {$ne: null}}


            return Appointment.aggregate([
                {
                    $match: matchCond
                },
                {
                    $lookup: {
                        from: "doctors",
                        let: {doctorId: "$doctor"},
                        pipeline: [
                            {$match: {$expr: {$eq: ["$_id", "$$doctorId"]}},},
                            {$project: {_id: 1, first_name: 1, last_name: 1}}
                        ],
                        as: "doctor"
                    }
                },
                {
                    $unwind: {
                        path: "$doctor",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        name: {$concat: ["$doctor.first_name", " ", "$doctor.last_name"]},
                        url: "$presc_url",
                        doctor_id: "$doctor._id",
                        appointment_id: "$_id",
                        created_at: 1,
                        updated_at: 1,
                        presc_added_at:"$updated_at"
                    }
                },
                {
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
                finalResult.docs = result.docs

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
            })

        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

const getReports = async (req, res) => {
    let {timezone = "Asia/Calcutta"} = req.headers
    const translator = translate(req.headers.lang);
    const validations = {
        // patient_id: "required",
    };
    let {sort_key = "created_at", sort_order = "desc", limit = 10, page = 1} = req.body
    let skipAndLimit = []
    if (typeof limit !== 'undefined') {
        skipAndLimit = [{$skip: limit * (page - 1)},
            {$limit: limit}]
    } else {
        skipAndLimit = [{$skip: 0}]
    }
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {patient_id, date, type} = req.body
            if (!patient_id)
                patient_id = res.locals.user.selected_profile_id
            let matchCond = {patient: ObjectId(patient_id)}
            if (date) {
                let start = getStartOfDateInUTC(date, timezone)
                let end = getEndOfDateInUTC(date, timezone)
                matchCond = {...matchCond, date: {$gte: start, $lte: end}}
            }
            if (type) {
                let typeArray = getArrayFromFilterParams(type, false)
                matchCond = {...matchCond, type: {$in: typeArray}}
            }

            return Report.aggregate([
                {
                    $match: matchCond
                },
                {
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
                finalResult.docs = result.docs
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
            })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

const getCountOfCancelAppointment = (req, res) => {
    const translator = translate(req.headers.lang);
    Patient.findOne({user_id: res.locals.user._id}).then(patient => {
        let resObj = {};
        resObj.number_of_attempts = patient.planned_cancellation;
        resObj.title = '';
        resObj.message = '';
        if (patient.planned_cancellation === 1) {
            resObj.title = 'This is the second time you are cancelling your scheduled appointment.';
            resObj.message = 'Are you sure you want to cancel your appointment? Refer the Fair Usage Policy for Terms and conditions of Cancellation and Refund Policies.';
        } else if(patient.planned_cancellation === 2) {
            resObj.title = 'This is the third and last time you can cancel your scheduled appointment.';
            resObj.message = 'Refer the Fair Usage Policies and Terms and conditions of cancellation and Refund Policy. You will no longer be able to cancel your appointments and the next time you try and cancel your appointment your profile will be suspended!!';
        } else {
            resObj.title = '';
            resObj.message = '';
        }
        return jsonResponse(
            res,
            resObj,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

const getDetails = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        patient_id: "required",
    };
    validate(req.body, validations)
    .then((matched) => {
        if (!matched.status) {
            throw new HandleError(matched.data, 422);
        }
        let {patient_id } = req.body ;
        Patient.find({_id: patient_id}).then(patient => {
            let resData = patient[0];
            return jsonResponse(
                res,
                resData,
                translator.__("retrieve_success"),
                200
            );
        })
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

module.exports = {
    index,
    index2,
    getHomeContent,
    getTopConsultants,
    bookAppointment,
    getAppointments,
    getAppointmentDetails,
    cancelAppointment,
    changeStatus,
    uploadReport,
    getReports,
    getPrescriptions,
    deleteReport,
    getCountOfCancelAppointment,
    getDetails,
    __checkDoctorAvailabilityMsg
}
