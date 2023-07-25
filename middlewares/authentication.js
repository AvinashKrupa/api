import User from "../db/models/user";
import {endSessionsAndCreateNew} from "../helpers/sessionHelper";
import * as config from "../config/config";
import Patient from "../db/models/patient";
import Doctor from "../db/models/doctor";
import {comparePassword} from "../helpers/hashHelper";

const {compose} = require("compose-middleware");
const {translate} = require("../helpers/multilingual");
const {errorResponse} = require("../helpers/responseHelper");

const {jwtStrategy} = require("./strategies/jwtStrategy");
const {refreshTokenStrategy} = require("./strategies/refreshTokenStrategy");
const {tempAccessStrategy} = require("./strategies/tempAccessStrategy");

const passport = require('passport');

const setupAuth = () => {
    passport.use('jwt', jwtStrategy);
    passport.use('refreshToken', refreshTokenStrategy);
    passport.use('tempAccess', tempAccessStrategy);
}
/**
 * Finds a user with specified phone number, if the user is already existing with requested profile type, treat it as a login
 * flow. Here check if the requested profile is active , otherwise revert back with error
 * If the user is already present, but the requested profile type is different than what is present in existing model,
 * send the existing user model back to be used for sign up
 * @returns {void|*}
 */
const authenticate = async (phoneNum, countryCode, type) => {
    let user = await User.findOne({mobile_number: phoneNum, country_code: countryCode})
    if (user && user.profile_types.includes(type)) {
        switch (type) {
            case config.constants.USER_TYPE_PATIENT:
                let patient = await Patient.findOne({user_id: user._id}, {_id: 1, status: 1})
                if(!patient)
                    return Promise.resolve({existing_user: user})
                if (patient.status !== "active") {
                    return Promise.reject(`Your account is ${patient.status}. Please contact customer support.`);
                }

                break;
            case config.constants.USER_TYPE_DOCTOR:
                let doctor = await Doctor.findOne({user_id: user._id}, {_id: 1, status: 1})
                if(!doctor)
                    return Promise.resolve({existing_user: user})
                if (!["active","pending"].includes(doctor.status)) {
                    return Promise.reject(`Your account is ${doctor.status}. Please contact customer support.`);
                }
                break;
        }
        return endSessionsAndCreateNew(user, type)
    } else {
        return Promise.resolve({existing_user: user})
    }
}
/**
 * @returns {void|*}
 */
const emailPassAuthenticate = async (username, password) => {
    let matchCond = {email: username.toLowerCase(), profile_types:{$elemMatch:{$eq:"3"}}}
    return User.findOne(matchCond).then(user => {
        if (user) {
            return comparePassword(password, user.password).then(response => {
                if (response !== true) {
                    return Promise.reject({code: 400, message: "Invalid email or password"})
                } else {
                    return Promise.resolve(user)
                }
            })
            //find existing session from table with same access token, if access token doesn't match return 401
        } else {
            return Promise.reject({code: 400, message: "Invalid email or password"})
        }
    });
}
/**
 * This middleware function determines if the accessToken passed is valid or not
 * @returns {RequestHandler<any, any, void>}
 */
const isAuthenticated = () => {
    return compose([
        function (req, res, next) {
            const translator = translate(req.headers.lang);
            try {
                passport.authenticate('jwt', {session: false}, async function (err, user, info) {
                    if (err || !user) {
                        return errorResponse(translator.__("invalid_token"), res, 401);
                    } else {
                        switch (user.selected_profile) {
                            case config.constants.USER_TYPE_PATIENT:
                                let patient = await Patient.findOne({user_id: user._id}, {_id: 1})
                                user["selected_profile_id"] = patient._id
                                break;
                            case config.constants.USER_TYPE_DOCTOR:
                                let doctor = await Doctor.findOne({user_id: user._id}, {_id: 1})
                                user["selected_profile_id"] = doctor._id
                                break;
                        }
                        res.locals.user = user
                        next()
                    }
                })(req, res, next)
            } catch (e) {
                return errorResponse(e, res, e.code);
            }
        }
    ])
}

/**
 * This middleware function determines if the accessToken passed is valid or not
 * @returns {RequestHandler<any, any, void>}
 */
const hasTempAccess = () => {
    return compose([
        function (req, res, next) {
            const translator = translate(req.headers.lang);
            try {
                // passport.authenticate('tempAccess', {session: false}, async function (err, user, info) {
                //     if (err ) {
                //         return errorResponse(translator.__("invalid_token"), res, 401);
                //     } else {
                //         next()
                //     }
                // })(req, res, next)
                next()
            } catch (e) {
                return errorResponse(e, res, e.code);
            }
        }
    ])
}
/**
 * This middleware function determines if the refreshToken passed is valid or not
 * @param options
 * @returns {RequestHandler<any, any, void>}
 */
const shouldRefreshToken = () => {
    return compose([
        function (req, res, next) {
            const translator = translate(req.headers.lang);
            try {
                passport.authenticate('refreshToken', {session: false}, async function (err, user, info) {
                    if (err || !user) {
                        return errorResponse(translator.__("invalid_token"), res, 401);
                    } else {
                        res.locals.user = user
                        next()
                    }
                })(req, res, next)
            } catch (e) {
                return errorResponse(e, res, e.code);
            }
        }
    ])
}


module.exports = {
    setupAuth,
    isAuthenticated,
    hasTempAccess,
    authenticate,
    shouldRefreshToken,
    emailPassAuthenticate
}
