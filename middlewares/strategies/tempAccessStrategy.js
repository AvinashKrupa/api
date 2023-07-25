import * as config from "../../config/config";

const JWTstrategy = require('passport-jwt').Strategy,
    ExtractJWT = require('passport-jwt').ExtractJwt;

const opts = {
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: config.secret,
};
const tempAccessStrategy = new JWTstrategy(opts, (jwt_payload, done) => {
    done(null, true)
})

module.exports = {tempAccessStrategy}
