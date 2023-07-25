import * as config from "../../config/config";
import {translate} from "../../helpers/multilingual";

import Session from "../../db/models/session.js";
import User from "../../db/models/user.js";

const JWTstrategy = require('passport-jwt').Strategy,
    ExtractJWT = require('passport-jwt').ExtractJwt;

const opts = {
    jwtFromRequest: ExtractJWT.fromBodyField("refresh_token"),
    secretOrKey: config.secret,
};
const refreshTokenStrategy = new JWTstrategy(opts, async (jwt_payload, done) => {
    try {
        const translator = translate('en');
        let session = await Session.findOne({_id: jwt_payload.sid})
        if (session) {
            /*We found a valid session and if the flow reached here, the token was also valid. Let's check if the user
           still is present or not and whether user has a valid status or not
            */
            User.findById(jwt_payload.user_id).then(user => {
                if (user) {
                    if (user.status !== "active") {
                        let message = translator.__("user_status_pending")
                        done(null, false, {code: 401, message: message});
                    } else {
                        user["selected_profile"] = jwt_payload.selected_profile
                        done(null, user);
                    }
                } else {
                    done(null, false);
                }
            });
        } else {
            done(null, false);
        }
    } catch (err) {
        done(err);
    }
})

module.exports = {refreshTokenStrategy}
