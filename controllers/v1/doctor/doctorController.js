import {translate} from "../../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import Slider from "../../../db/models/slider";
import * as config from "../../../config/config";
import Appointment from "../../../db/models/appointment";
import Language from "../../../db/models/language";
import {
    getEndOfDateInUTC,
    getFormattedMomentFromDB,
    getStartOfDateInUTC,
    getTimezonedDateFromUTC
} from "../../../helpers/timeHelper";
import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";
import Doctor from "../../../db/models/doctor";
import {getLookupForByTags} from "../../../helpers/modelHelper";
import {getConsultantAggregate} from "../../../helpers/consultantHelper";
import {getArrayFromFilterParams} from "../../../helpers/controllerHelper";
import {getLookupAggregateForPatient, getAppointmentStats} from "../../../helpers/appointmentHelper";
import Unavailability from "../../../db/models/unavailabilty";
import {getDateTimeForSlot} from "../../../helpers/slotHelper";

import {sendPushNotification} from "../../../helpers/fcmHelper";
import {createNotification} from "../../../helpers/notificationHelper";
import User from "../../../db/models/user";
import {sendMsg} from "../../../helpers/twilioHelper";
import {sendEmail} from "../../../helpers/emailNotifier";
import { async } from "regenerator-runtime";
const path = require('path');

import {createAdminLog} from "../../../helpers/adminlogHelper";
import {__checkDoctorAvailabilityMsg} from "../patient/patientController";

let moment = require('moment-timezone');
const index = (req, res) => {
    const translator = translate(req.headers.lang);
    Doctor.find()
        .populate({path: 'qualif.dept_id', select: "title", options: {withDeleted: true}})
        .populate({path: 'qualif.quals qualif.highest_qual', select: "name", options: {withDeleted: true}})
        .populate({path: 'user_id', select: "first_name last_name dp"})
        .populate({path: 'created_by updated_by', select: "first_name last_name"})
        .then(doctors => {
            return jsonResponse(
                res,
                doctors,
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

    let deptNameMatch = {}
    let matchOpts = {}
    if (filter) {
        if (filter.dept_name) {
            let deptNameArray = getArrayFromFilterParams(filter.dept_name, false);
            if (deptNameArray.length > 0)
                deptNameMatch = {"dept.title": {$in: deptNameArray}}
        }
        if (filter.name) {
            let regexExp = new RegExp(filter.name.replace(" ", "|"), "ig")
            matchOpts = {...matchOpts, "first_name": {$regex: regexExp}}
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
        if (filter.specialities) {
            let specialityArray = getArrayFromFilterParams(filter.specialities);
            if (specialityArray.length > 0)
                matchOpts = {...matchOpts,"qualif.specl._id": {$in: specialityArray}}
        }
    }

    return Doctor.aggregate([
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
                    {$project: {_id: 1, dp: 1,email:1, mobile_number:1,country_code:1, dob:1, language:1, gender:1}}
                ],
                as: "user_id"
            }
        },
        {$unwind: "$user_id"},
        {
            $lookup: {
                from: "departments",
                let: {baseId: "$$ROOT.qualif.dept_id"},
                pipeline: [
                    {$match: {$expr: {$eq: ["$_id", "$$baseId"]}},},
                    {$project: {_id: 1, title: 1}}
                ],
                as: "dept"
            }
        },
        {$unwind: "$dept"},
        {$match: {...deptNameMatch}},
        {
            $lookup: {
                from: "qualifications",
                let: {baseId: "$$ROOT.qualif.highest_qual"},
                pipeline: [
                    {$match: {$expr: {$eq: ["$_id", "$$baseId"]}},},
                    {$project: {_id: 1, name: 1}}
                ],
                as: "highest_qual"
            }
        },
        {$unwind: "$highest_qual"},
        ...getLookupForByTags(),
        {
            $project: {
                first_name: 1,
                last_name: 1,
                user_id: 1,
                status: 1,
                address:1,
                qualif: {
                    specl: "$qualif.specl",
                    dept_id: "$dept",
                    med_reg_num: "$qualif.med_reg_num",
                    fee: "$qualif.fee",
                    highest_qual: "$highest_qual",
                    exp: "$qualif.exp"
                },
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
            let appointment_stats = await getAppointmentStats(doc._id);
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
    let sliders = await Slider.find({user_type: config.constants.USER_TYPE_DOCTOR, enabled: true})

    return jsonResponse(
        res,
        {
            slider: sliders,
        },
        translator.__("retrieve_success"),
        200
    );

};
const changeStatus = async (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        doctor_id: "required",
        status: "required"
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {status, doctor_id} = req.body;
            return Doctor.findOneAndUpdate({_id: doctor_id}, {
                status: status,
                updated_by: res.locals.user
            }, {returnDocument: true}).then(async result => {
                //Sending push notification to the doctor user
                let user = await User.findOne({
                    _id: result.user_id,
                });

                if (status == 'active') {
                    let logData = {};
                    logData.user_id = res.locals.user._id;
                    logData.module_name = config.constants.LOG_MSG_MODULE_NAME.DOCTOR_PROFILE
                    logData.title = config.constants.LOG_MSG_TITLE.DOCTOR_PROFILE_APPROVAL;
                    logData.message = config.constants.LOG_MESSAGE.DOCTOR_PROFILE_APPROVAL;
                    logData.message = logData.message.replace('{{admin}}', res.locals.user.first_name +' '+ res.locals.user.last_name);
                    logData.message = logData.message.replace('{{doctor_name}}', result.first_name +' '+ result.last_name);
                    logData.record_id =  doctor_id;
                    await createAdminLog(logData);
        
                    let sendData = {};
                    sendData.device_token = user.device_token;
                    sendData.notification_title = config.constants.NOTIFICATION_TITLE.DOCTOR_PROFILE_APPROVAL;
                    sendData.notification_body = config.constants.NOTIFICATION_MESSAGE.DOCTOR_PROFILE_APPROVAL;
                    sendData.notification_data = {type: config.constants.NOTIFICATION_TYPE.DOCTOR_PROFILE_APPROVAL}
                    sendPushNotification(sendData);
                    // Using to store notification message in the notification table.  
                    let storeData = {};
                    storeData.user_id = result.user_id;
                    storeData.title = sendData.notification_title
                    storeData.message = sendData.notification_body;
                    storeData.message_type = config.constants.NOTIFICATION_TYPE.DOCTOR_PROFILE_APPROVAL;
                    createNotification(storeData);
                    // Sending message notification to the doctor user
                    let msg, mobile_number;
                    msg = config.constants.NOTIFICATION_MESSAGE.DOCTOR_PROFILE_APPROVAL;
                    mobile_number = user.country_code + user.mobile_number;
                    await sendMsg(mobile_number, msg);
                    /* Using to send email notification as per the status. */
                    await res.render(path.resolve(__dirname + '/../../../views/doctorProfileApproved.ejs'), {
                        message: {name: user.first_name + ' ' + user.last_name}
                    }, async (err, html) => {
                        if (err) {
                            //console.error("Something went wrong during render html in ctr", JSON.stringify(err));
                        }
                        await sendEmail(user.email, config.constants.EMAIL_SUBJECT.DOCTOR_PROFILE_APPROVAL, html);
                    });
                } else if (status == 'inactive') {
                    /* Using to send email notification as per the status. */
                    await res.render(path.resolve(__dirname + '/../../../views/doctorProfileRejected.ejs'), {
                        message: {name: user.first_name + ' ' + user.last_name}
                    }, async (err, html) => {
                        if (err) {
                            //console.error("Something went wrong during render html in ctr", JSON.stringify(err));
                        }
                        await sendEmail(user.email, config.constants.EMAIL_SUBJECT.DOCTOR_PROFILE_REJECTED, html);
                    });
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
/**
 *
 * @param req
 * @param res
 */
const getDoctorDetails = async (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers;
    const validations = {
        doctor_id: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);

            }
            let {include_similar = false, doctor_id} = req.body
            return Doctor.findOne({_id: doctor_id})
                .populate({path: 'qualif.dept_id', select: "title", options: {withDeleted: true}})
                .populate({path: 'qualif.quals qualif.highest_qual', select: "name", options: {withDeleted: true}})
                .populate({path: 'user_id', select: "first_name last_name dp language"})
                .then(async doctor => {
                    let results = await Promise.all([
                        Appointment.find({doctor: doctor_id, status: "completed"}, {_id: 1}),
                        Language.find({_id: {$in: doctor.user_id.language}}, {name: 1})
                    ])
                    let speclArr = [];
                    let total_consultations ;
                    total_consultations = results[0] ? results[0].length : 0 ;
                    if(doctor.set_consultation) {
                        total_consultations = total_consultations + doctor.set_consultation;
                    }
                    let doctorResp = {
                        first_name: doctor.first_name,
                        last_name: doctor.last_name,
                        dp: doctor.user_id.dp,
                        fee: doctor.qualif.fee,
                        huno_id: doctor.huno_id,
                        language: results[1].map(lang => {
                            return lang.name
                        }),
                        specialities: doctor.qualif.specl.map(specl => {
                            speclArr.push(specl._id)
                            return specl.title
                        }),
                        exp: doctor.qualif.exp,
                        country: doctor.address.country,
                        city: doctor.address.city,
                        desc: doctor.desc,
                        shift: doctor.avail.shift,
                        day: doctor.avail.day,
                        total_consultations: total_consultations,
                        similar_doctors: [],
                        slots: doctor.avail.slots,
                    }
                    if (include_similar) {
                        let options = {
                            sort_key: "exp",
                            sort_order: "desc",
                            limit: 10,
                            filter: {
                                specialities: speclArr,
                                excluded_id: doctor._id
                            }

                        }
                        let similarDocAggregate = getConsultantAggregate(options)
                        let similar_doctors = await Doctor.aggregate(similarDocAggregate).then( async (results) => {
                            let result = results[0]
                            for await (let doc of result.docs) {
                                let resData = await __checkDoctorAvailabilityMsg(doc._id, timezone)
                                doc.next_avail_slot_time = resData.next_avail_slot_time ;
                            }
                            return Promise.resolve(result.docs);
                        })
                        doctorResp.similar_doctors = similar_doctors
                    }

                    return jsonResponse(
                        res,
                        doctorResp,
                        translator.__("retrieve_success"),
                        200
                    );

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
    let {sort_key = "time.utc_time", sort_order = "desc", limit = 10, page = 1, status, date, search_text, is_random=false} = req.body;
    let skipAndLimit = []
    if (typeof limit !== 'undefined') {
        skipAndLimit = [{$skip: limit * (page - 1)},
            {$limit: limit}]
    } else {
        skipAndLimit = [{$skip: 0}]
    }

    let doctArray = getArrayFromFilterParams(res.locals.user.selected_profile_id);
    let matchCond = {
        $or: [
            {doctor: res.locals.user.selected_profile_id},
            {additional_doc: {$in: doctArray}}
        ]
    }
    let statusArray = getArrayFromFilterParams(status, false);
    if (statusArray.length > 0) {
        matchCond = {...matchCond, status: {$in: statusArray}}
    }
    if (date && date !== "") {
        let utcStart = getStartOfDateInUTC(req.body.date, timezone)
        let utcEnd = getEndOfDateInUTC(req.body.date, timezone)
        matchCond = {...matchCond, "time.utc_time": {$gte: utcStart, $lte: utcEnd}}
    }
    let orOpts = {}
    if (search_text && search_text !== "") {
        let regexExp = new RegExp(search_text.replace(" ", "|"), "ig")
        orOpts = {
            $or: [
                {"patient.user.first_name": {$regex: regexExp}},
                {"patient.user.last_name": {$regex: regexExp}},
            ]
        }
    }
    let aggregateQuery;
    if(is_random) {
        aggregateQuery =  [
            {$match: matchCond},
            { $sample: { size: limit} },
            {
                ...getLookupAggregateForPatient()
            },
            {$unwind: {path: "$patient"}},
            {$match: {...orOpts}},
            ...getLookupForByTags(),
            {
                $project: {
                    first_name: "$patient.user.first_name",
                    last_name: "$patient.user.last_name",
                    dp: "$patient.user.dp",
                    patient_id: "$patient._id",
                    reason: 1,
                    complaints: 1,
                    created_by: 1,
                    updated_by: 1,
                    time: 1,
                    status: 1,
                    consulting_type: 1,
                    created_at: 1,
                    updated_at: 1,
                    cancel_reason: 1,
                    huno_id: 1,
                    adtnl_status: 1
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
    
        ]
    } else {
        aggregateQuery =  [
            {$match: matchCond},
            {
                ...getLookupAggregateForPatient()
            },
            {$unwind: {path: "$patient"}},
            {$match: {...orOpts}},
            ...getLookupForByTags(),
            {
                $project: {
                    first_name: "$patient.user.first_name",
                    last_name: "$patient.user.last_name",
                    dp: "$patient.user.dp",
                    patient_id: "$patient._id",
                    reason: 1,
                    complaints: 1,
                    created_by: 1,
                    updated_by: 1,
                    time: 1,
                    status: 1,
                    consulting_type: 1,
                    created_at: 1,
                    updated_at: 1,
                    cancel_reason: 1,
                    huno_id: 1,
                    adtnl_status: 1
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
    
        ]
    }

    return Appointment.aggregate(aggregateQuery).then(results => {
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

const updateSchedule = (req, res) => {
    let {timezone = "Asia/Calcutta"} = req.headers
    const validations = {
        date: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {unavailable_slots, available_slots, date, doctor_id} = req.body
            if (!doctor_id) {
                doctor_id = res.locals.user.selected_profile_id
            }
            let unavailSlots = getArrayFromFilterParams(unavailable_slots, false)
            let availSlots = getArrayFromFilterParams(available_slots, false)

            let availabilityBulkWriteOp = []
            let combinedArray = [...availSlots, ...unavailSlots]

            combinedArray.forEach(slot => {
                availabilityBulkWriteOp.push(
                    {
                        updateOne: {
                            filter: {
                                slot: slot,
                                date: getDateTimeForSlot(slot, date, timezone, "YYYY-MM-DD"),
                                doctor: doctor_id,
                            },
                            update: {
                                $set: {
                                    slot: slot,
                                    date: getDateTimeForSlot(slot, date, timezone, "YYYY-MM-DD"),
                                    doctor: doctor_id,
                                    is_avail: availSlots.includes(slot)
                                }
                            },
                            upsert: true
                        }
                    }
                )
            })

            let availPromises = []

            if (availabilityBulkWriteOp.length > 0) {
                availPromises.push(Unavailability.bulkWrite(availabilityBulkWriteOp))
            }
            if (availPromises.length === 0) {
                throw new HandleError("Please specify either of the available or unavailable slots.", 400)
            }
            return Promise.all(availPromises).then(results => {
                return jsonResponse(
                    res,
                    null,
                    "Updated schedule for selected date.",
                    200
                );
            })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

const setConsultation = (req, res) => {
    const translator = translate(req.headers.lang);
    Doctor.find({set_consultation: ""},  {_id:1 , set_consultation: 1})
        .then(doctors => {
            doctors.forEach( async(doctor) => {
                let randomConsultation = Math.floor(Math.random() * 6) + 1 ;
                await Doctor.findOneAndUpdate({_id: doctor._id}, {set_consultation: randomConsultation})
            });
            return jsonResponse(
                res,
                doctors,
                translator.__("retrieve_success"),
                200
            );
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

module.exports = {
    index,
    index2,
    getHomeContent,
    getAppointments,
    getDoctorDetails,
    changeStatus,
    updateSchedule,
    setConsultation,
}
