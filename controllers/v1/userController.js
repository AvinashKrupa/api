import {translate} from "../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import * as config from "../../config/config";
import User from "../../db/models/user";
import {getAdditionalInfo, updateDoctor, updatePatient, updateDoctor2} from "../../helpers/userHelper";
import {validate} from "../../helpers/validator";
import {HandleError} from "../../helpers/errorHandling";
import Doctor from "../../db/models/doctor";
import Patient from "../../db/models/patient";

/**
 * List all users
 * @param req
 * @param res
 */
const index = (req, res) => {
    const translator = translate(req.headers.lang);
    User.find({}).then(users => {
        return jsonResponse(
            res,
            users,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

}

/**
 * Get profile of user from the jwt token specified in header
 * @param req
 * @param res
 */
const getProfile = async (req, res) => {
    const translator = translate(req.headers.lang);
    let additionalInfo = await getAdditionalInfo(res.locals.user._id, res.locals.user.selected_profile, {load_doctor_stats: true})
    return jsonResponse(
        res,
        {user: res.locals.user, additional_info: additionalInfo},
        translator.__("retrieve_success"),
        200
    );
};
const getUserProfile = async (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {user_id: "required"};
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {user_id, type, profile_type} = req.body
            let additional_info, user, patient, doctor;
            switch (profile_type) {
                case 1:
                  patient = await Patient.findOne({_id: user_id})
                  user = await User.findOne({_id: patient.user_id})
                  user_id = patient.user_id;
                  break;
                case 2:
                  doctor = await Doctor.findOne({_id: user_id})   
                  user = await User.findOne({_id: doctor.user_id})
                  user_id = doctor.user_id;
                  break;
                default:
                  user = await User.findOne({_id: user_id})
                  break;
            }
            if (type) {
                additional_info = await getAdditionalInfo(user_id, type, {load_doctor_stats: true})
            }
            return jsonResponse(
                res,
                {user, additional_info},
                translator.__("retrieve_success"),
                200
            );

        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });

};
const updateProfile = async (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    const validations = {};
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {user_id, type} = req.body
            if (!user_id)
                user_id = res.locals.user._id
            if (!type)
                type = res.locals.user.selected_profile
            let user
            switch (type) {
                case config.constants.USER_TYPE_PATIENT:
                    user = await updatePatient(user_id, req.body, res.locals.user)
                    break;
                case config.constants.USER_TYPE_DOCTOR:
                    user = await updateDoctor(user_id, req.body, res.locals.user, timezone)
            }

            return jsonResponse(
                res,
                user,
                translator.__("update_success"),
                200
            );

        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });
};

const updateProfile2 = async (req, res) => {
    const translator = translate(req.headers.lang);
    req.body = JSON.parse(req.body.user_data);
    let {timezone = "Asia/Calcutta"} = req.headers
    const validations = {};
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {user_id, type} = req.body
            if (!user_id)
                user_id = res.locals.user._id
            if (!type)
                type = res.locals.user.selected_profile
            let user
            switch (type) {
                case config.constants.USER_TYPE_PATIENT:
                    user = await updatePatient(user_id, req.body, res.locals.user)
                    break;
                case config.constants.USER_TYPE_DOCTOR:
                    user = await updateDoctor2(user_id, req.body, res.locals.user, timezone, req.files)
            }

            return jsonResponse(
                res,
                user,
                translator.__("update_success"),
                200
            );

        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });


};

const updateDeviceToken = async (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        device_token: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {device_token} = req.body
            await User.findOneAndUpdate({_id: res.locals.user._id}, {device_token: device_token})

            return jsonResponse(
                res,
                null,
                translator.__("update_success"),
                200
            );

        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });


};

module.exports = {
    index,
    getProfile,
    getUserProfile,
    updateProfile,
    updateDeviceToken,
    updateProfile2,
}
