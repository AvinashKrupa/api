import {translate} from "../../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";
import Appointment from "../../../db/models/appointment";
import {getFormattedMomentFromDB, getTimezonedDateFromUTC} from "../../../helpers/timeHelper";
import {getLookupAggregateForDoctor, getLookupAggregateForPatient} from "../../../helpers/appointmentHelper";
import {getLookupForByTags} from "../../../helpers/modelHelper";
import {uploadFile} from "../../../helpers/s3FileUploadHelper";
import Report from "../../../db/models/report";
import {getArrayFromFilterParams} from "../../../helpers/controllerHelper";

let moment = require('moment-timezone');
const index = (req, res) => {
    const translator = translate(req.headers.lang);
    return jsonResponse(
        res,
        [],
        translator.__("retrieve_success"),
        200
    );
}
const getAppointments = async (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    let {sort_key = "time.utc_time", sort_order = "desc", limit = 10, page = 1, search_text} = req.body

    let skipAndLimit = []
    if (typeof limit !== 'undefined') {
        skipAndLimit = [{$skip: limit * (page - 1)},
            {$limit: limit}]
    } else {
        skipAndLimit = [{$skip: 0}]
    }

    let matchCond = {status: "completed", labconsultation: {$ne: null}}


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
    return Appointment.aggregate([
        {$match: matchCond},
        {
            ...getLookupAggregateForPatient({mobile_number: 1, country_code: 1})
        },
        {$unwind: {path: "$patient"}},
        {$match: {...orOpts}},
        {
            ...getLookupAggregateForDoctor()
        },
        {$unwind: {path: "$doctor"}},
        ...getLookupForByTags(),
        {
            $project: {
                patient: {
                    first_name: "$patient.user.first_name",
                    last_name: "$patient.user.last_name",
                    dp: "$patient.user.dp",
                    _id: "$patient._id",
                    mobile_number: "$patient.user.mobile_number",
                    country_code: "$patient.user.country_code",
                },
                doctor: {
                    first_name: "$doctor.first_name",
                    last_name: "$doctor.last_name",
                    _id: "$doctor._id",
                },
                created_by: 1,
                updated_by: 1,
                time: 1,
                status: 1,
                created_at: 1,
                updated_at: 1,
                huno_id: 1
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
        finalResult.search_text = search_text;
        return jsonResponse(
            res,
            finalResult,
            translator.__("retrieve_success"),
            200
        );
    }).catch(error => errorResponse(error, res));
};

const uploadReport = async (req, res) => {
    const translator = translate(req.headers.lang);
    if (!req.files || req.files.length === 0) {
        return errorResponse("Please provide a valid file", res, 400);
    }
    const validations = {
        appointment: "required",
        patient: "required",
        date: "required",
        title: "required",
        type: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {date, title, type, patient, appointment, department} = req.body
            date = getArrayFromFilterParams(date, false)
            title = getArrayFromFilterParams(title, false)
            type = getArrayFromFilterParams(type, false)
            patient = getArrayFromFilterParams(patient)
            appointment = getArrayFromFilterParams(appointment)
            department = getArrayFromFilterParams(department)
            let promises = []
            for (let i = 0; i < req.files.length; i++) {
                let file = req.files[i]
                promises.push(uploadFile(file, "report").then(result => {
                    let model = new Report()
                    model.date = date[i]
                    model.title = title[i]
                    model.type = type[i]
                    model.patient = patient[i]
                    model.appointment = appointment[i]
                    if (department && department.length > 0 && department[i]) {
                        model.department = department[i]
                    }
                    model.url = result.Location
                    model.updated_by = res.locals.user._id
                    model.created_by = res.locals.user._id
                    return model.save()
                }))
            }
            return Promise.all(promises).then(results => {
                return jsonResponse(
                    res,
                    null,
                    translator.__("upload_success"),
                    200
                );
            })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
};
module.exports = {
    index,
    getAppointments,
    uploadReport
}
