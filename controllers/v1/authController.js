import {validate} from "../../helpers/validator";
import {HandleError} from "../../helpers/errorHandling";
import {translate} from "../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import {createSession, endSession, endSessionsAndCreateNew, getTempAccessToken} from "../../helpers/sessionHelper";
import {sendVerificationOtp, verifyOTP} from "../../helpers/twilioHelper";
import {authenticate, emailPassAuthenticate} from "../../middlewares/authentication";
import * as config from "../../config/config";
import {createDoctor, createPatient, getAdditionalInfo, createDoctor2, createAdminUser} from "../../helpers/userHelper";
import User from "../../db/models/user";
import {setAttributes} from "../../helpers/modelHelper";
import Doctor from "../../db/models/doctor";
import Patient from "../../db/models/patient";
import {cryptPassword} from "../../helpers/hashHelper";

/**
 * Send out an otp to specified mobile number using twilio
 * keys
 * @param req
 * @param res
 */
const sendOtp = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        mobile_number: "required",
        country_code: "required",
        type: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {mobile_number, country_code, type} = req.body
            let user = await User.findOne({mobile_number: mobile_number, country_code: country_code})
            if (user
                && user.profile_types.length === 1
                && user.profile_types.includes(config.constants.USER_TYPE_PATIENT)
                && type.toString() === config.constants.USER_TYPE_DOCTOR) {
                throw new HandleError("The number already exists as a patient. Please use different mobile number.", 400)
            }
            
            if (user
                && user.profile_types.length === 1
                && user.profile_types.includes(config.constants.USER_TYPE_DOCTOR)
                && type.toString() === config.constants.USER_TYPE_PATIENT) {
                throw new HandleError("The number already exists as a doctor. Please use different mobile number.", 400)
            } 
             
            if(user){
                let additionalProf
                switch (type.toString()) {
                    case config.constants.USER_TYPE_DOCTOR:
                        additionalProf=await Doctor.findOne({user_id:user._id})
                        break;
                    case config.constants.USER_TYPE_PATIENT:
                        additionalProf=await Patient.findOne({user_id:user._id})
                        break;
                }
                if(additionalProf&&additionalProf.status!=="active"){
                    return errorResponse({data:{call:"+918001156789",email:"support@diamed.app"},message:`Your profile is ${additionalProf.status}. Please contact support.`},res,400)
                }
            }

            return sendVerificationOtp(`${req.body.country_code}${req.body.mobile_number}`).then(result => {
                return jsonResponse(
                    res,
                    null,
                    translator.__("otp_sent"),
                    200
                );
            })
        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });
};
const verifyOtp = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        mobile_number: "required",
        country_code: "required",
        otp: "required",
        type: "required",
        device_type: "required"
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {type, mobile_number, country_code, otp, device_type, device_token} = req.body
            return verifyOTP(otp, `${country_code}${mobile_number}`).then(async result => {
                let userSessionObj = await authenticate(mobile_number, country_code, type.toString());

                //Update user's device details  
                await User.findOneAndUpdate({mobile_number: mobile_number}, {
                    device_type: device_type,
                    device_token: device_token
                });
                if (userSessionObj && !userSessionObj.hasOwnProperty("existing_user")) {
                    userSessionObj["additional_info"] = await getAdditionalInfo(userSessionObj.user._id, type.toString())
                    return jsonResponse(
                        res,
                        userSessionObj,
                        translator.__("otp_verified"),
                        200
                    );
                } else {
                    let tempAccessToken = getTempAccessToken(mobile_number, type.toString())
                    return jsonResponse(
                        res,
                        {tempAccessToken, existing_user: userSessionObj.existing_user},
                        translator.__("otp_verified"),
                        200
                    );
                }
            })
        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });
};

const registerUser = (req, res) => {
    const translator = translate(req.headers.lang);
    let {test = false} = req.headers;
    let validations;
    if(req.body.type.toString() === config.constants.USER_TYPE_PATIENT) {
        validations = {
            first_name: "required",
            //last_name: "required",
            mobile_number: "required",
            country_code: "required",
            type: "required",
            device_type: "required",
            gender: "required"
        };
    } else {
        validations = {
            first_name: "required",
            //last_name: "required",
            mobile_number: "required",
            country_code: "required",
            type: "required",
            device_type: "required",
            email: "required",
            gender: "required"
        };
    }

    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let type = req.body.type.toString();
            let user = await User.findOne({
                mobile_number: req.body.mobile_number,
                country_code: req.body.country_code,
            })
            let existing = user && user.profile_types.includes(type)
            if (existing) {
                throw new HandleError("User already exists in system", 400)
            } else if (!user) {
                user = new User()
                setAttributes(req.body, res.locals.user, user, true)
                user.status = "active"
            } else if (user
                && user.profile_types.includes(config.constants.USER_TYPE_PATIENT)
                && type === config.constants.USER_TYPE_DOCTOR) {
                throw new HandleError("Patient cannot register as a doctor", 400)
            }
            switch (type) {
                case config.constants.USER_TYPE_PATIENT:
                    user = await createPatient(user, req.body, res.locals.user)
                    break
                case config.constants.USER_TYPE_DOCTOR:
                    user = await createDoctor(user, req.body, res.locals.user, test, false)
            }

            if (!user) {
                throw new HandleError("Error occurred in registering user", 400)
            }
            let additional_info = await getAdditionalInfo(user._id, type.toString())
            return authenticate(user.mobile_number, user.country_code, type).then(userSessionObj => {
                return jsonResponse(
                    res,
                    {...userSessionObj, additional_info: additional_info},
                    translator.__("create_success"),
                    200
                );
            })
        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });
};

const registerUser2 = (req, res) => {
    req.body = JSON.parse(req.body.user_data);
    const translator = translate(req.headers.lang);
    let {test = false} = req.headers
    let validations = {
        first_name: "required",
        //last_name: "required",
        mobile_number: "required",
        country_code: "required",
        type: "required",
        device_type: "required",
        email: "required",
        gender: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let type = req.body.type.toString();
            let user = await User.findOne({
                mobile_number: req.body.mobile_number,
                country_code: req.body.country_code,
            })
            let existing = user && user.profile_types.includes(type)
            if (existing) {
                throw new HandleError("User already exists in system", 400)
            } else if (!user) {
                user = new User()
                setAttributes(req.body, res.locals.user, user, true)
                user.status = "active"
            } else if (user
                && user.profile_types.includes(config.constants.USER_TYPE_PATIENT)
                && type === config.constants.USER_TYPE_DOCTOR) {
                throw new HandleError("Patient cannot register as a doctor", 400)
            }
            switch (type) {
                case config.constants.USER_TYPE_PATIENT:
                    user = await createPatient(user, req.body, res.locals.user)
                    break
                case config.constants.USER_TYPE_DOCTOR:
                    user = await createDoctor2(user, req.body, res.locals.user, test, false, req.files)

            }

            if (!user) {
                throw new HandleError("Error occurred in registering user", 400)
            }
            let additional_info = await getAdditionalInfo(user._id, type.toString())
            return authenticate(user.mobile_number, user.country_code, type).then(userSessionObj => {
                return jsonResponse(
                    res,
                    {...userSessionObj, additional_info: additional_info},
                    translator.__("create_success"),
                    200
                );
            })
        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });
};

/**
 * Logout the user and terminate the session, while also putting record in session logs
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
const logout = async (req, res) => {
    try {
        const translator = translate(req.headers.lang);
        await endSession(res.locals.user._id)

        return jsonResponse(
            res,
            null,
            translator.__("successful_logout"),
            200
        );
    } catch (e) {
        return errorResponse(e, res, e.code);
    }
};


/**
 * Refreshes the access token based on the refresh token supplied
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
const refreshAccessToken = async (req, res) => {
    const translator = translate(req.headers.lang);
    return endSessionsAndCreateNew(res.locals.user, res.locals.user.selected_profile).then(result => {
        return jsonResponse(res, result.session, translator.__("update_success"), 200)
    }).catch(e => {
        return errorResponse(e, res, e.code);
    });
};

const registerAdminUser = (req, res) => {
    const translator = translate(req.headers.lang);
    let validations = {
        first_name: "required",
        //last_name: "required",
        mobile_number: "required",
        country_code: "required",
        type: "required",
        email: "required",
        password: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let type = req.body.type.toString();
            if(type!== config.constants.USER_TYPE_ADMIN) {
                return errorResponse("Invalid user type!, please input correct admin user type", res, 400);
            }

            let matchCond = {email: req.body.email, profile_types:{$elemMatch:{$eq:"3"}}}
            let user = await User.findOne(matchCond)
            let existing = user && user.profile_types.includes(type)
            if (existing) {
                throw new HandleError("User already exists in system", 400)
            } else if (!user) {
                user = new User()
                setAttributes(req.body, res.locals.user, user, true)
                user.status = "active"
                user.role_id = "612362ab40eef4f51b11e4d9";
                user.password = cryptPassword(req.body.password);
            } 
            user = await createAdminUser(user);
            if (!user) {
                throw new HandleError("Error occurred in registering user", 400)
            }
            let additional_info = await getAdditionalInfo(user._id, type.toString())
            return authenticate(user.mobile_number, user.country_code, type).then(userSessionObj => {
                return jsonResponse(
                    res,
                    {...userSessionObj, additional_info: additional_info},
                    translator.__("create_success"),
                    200
                );
            })
        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });
};

const adminLogin = async (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        email: "required|email",
        password: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {email, password} = req.body
            return emailPassAuthenticate(email, password).then(user => {
                if (user && user.role_id == "612362ab40eef4f51b11e4d9") {
                    return createSession(user).then(result => {
                        return jsonResponse(res, result, translator.__("successful_login"), 200)
                    })
                } else {
                    return errorResponse("Invalid email or password", res, 400);
                }
            })
        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });

};
const login = async (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        email: "required|email",
        password: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {email, password} = req.body
            return emailPassAuthenticate(email, password).then(user => {
                return createSession(user).then(result => {
                    return jsonResponse(res, result, translator.__("successful_login"), 200)
                })
            })
        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });

};

module.exports = {
    sendOtp,
    verifyOtp,
    logout,
    refreshAccessToken,
    registerUser,
    adminLogin,
    login,
    registerUser2,
    registerAdminUser
};
