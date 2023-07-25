import {translate} from "../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import Slot from "../../db/models/slot";
import {createSlots, getShiftSpecificSlots, getSlotsInRange} from "../../helpers/slotHelper";
import {validate} from "../../helpers/validator";
import {HandleError} from "../../helpers/errorHandling";
import Doctor from "../../db/models/doctor";
import {getDateTimeFromDate} from "../../helpers/timeHelper";
import {findBookedSlots} from "../../helpers/appointmentHelper";
import * as config from "../../config/config";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    Slot.find({}).then(slots => {
        return jsonResponse(
            res,
            slots,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

}


const getSlots = (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    let startTime = req.body.start
    let endTime = req.body.end
    getSlotsInRange(startTime, endTime, timezone).then(slots => {
        return jsonResponse(
            res,
            slots,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

}
const getAvailableSlots = (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers

    const validations = {
        doctor_id: "required",
        date: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let momentOfDate = getDateTimeFromDate(req.body.date, timezone)
            if (!momentOfDate.isValid()) {
                throw new HandleError("Please provide valid date", 400)
            }

            let day = momentOfDate.format("ddd").toLowerCase()
            let key = "avail.day." + day
            return Doctor.findOne({_id: req.body.doctor_id, [key]: true}, {avail: 1}).then(async doctor => {
                let shifts = {
                    shift1: [],
                    shift2: []
                }
                if (doctor) {
                    let patient_id = (res.locals.user.selected_profile == config.constants.USER_TYPE_PATIENT) ? res.locals.user.selected_profile_id : null;
                    let docSlots = await findBookedSlots([doctor._id], momentOfDate, timezone, patient_id)
                    let slotsAlreadyBooked = docSlots[doctor._id] || []
                    let lookAhead = req.body.look_ahead || (res.locals.user.selected_profile == config.constants.USER_TYPE_PATIENT)
                    shifts = await getShiftSpecificSlots(doctor, slotsAlreadyBooked, momentOfDate, timezone, lookAhead)
                }
                return jsonResponse(
                    res,
                    shifts,
                    translator.__("retrieve_success"),
                    200
                );
            })
        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });


}
const generateSlots = (req, res) => {
    const translator = translate(req.headers.lang);
    createSlots().then(slots => {
        return jsonResponse(
            res,
            slots,
            translator.__("create_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

}

module.exports = {
    index,
    generateSlots,
    getSlots,
    getAvailableSlots
}
