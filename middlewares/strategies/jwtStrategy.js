import * as config from "../../config/config";
import {translate} from "../../helpers/multilingual";

import User from "../../db/models/user.js";
import Session from "../../db/models/session.js";

const JWTstrategy = require('passport-jwt').Strategy,
    ExtractJWT = require('passport-jwt').ExtractJwt;

const opts = {
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: config.secret,
};
const jwtStrategy = new JWTstrategy(opts, (jwt_payload, done) => {
    try {
        const translator = translate('en');
        User.findById(jwt_payload.user_id).then(user => {
            if (user) {
                if (user.status !== "active") {
                    let message = translator.__("user_status_pending")
                    return done(null, false, {code: 401, message: message});
                }
                //find existing session from table with same access token, if access token doesn't match return 401
                return Session.findOne({_id: jwt_payload.sid}).then(session => {
                    if (session) {
                        user["selected_profile"] = jwt_payload.selected_profile
                        done(null, user);
                    } else {
                        done(null, false);
                    }
                })
            } else {
                done(null, false);
            }
        });
    } catch (err) {
        done(err);
    }
})

module.exports = {jwtStrategy}
