const config = require("../config/config");

let bcrypt = require("bcrypt");
let crypto = require("crypto");
const jwt = require("jsonwebtoken");

const BCRYPT_SALT_ROUNDS = 10;

const cryptPassword = (password) => {
    return bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);
};

const comparePassword = async (plainPass, hashword) => {
    return await bcrypt.compare(plainPass, hashword);
};

const generateSessionID = () => {
    return crypto.randomBytes(16).toString("base64");
};
const getBase64 = (string) => {
    return new Buffer(string).toString("base64");
};
const getStringFromBase64 = (base64string) => {
    return new Buffer(base64string, "base64").toString();
};
const createJwtToken = (obj, expiry,secret) => {
    if(!secret){
        secret=config.secret
    }
    return jwt.sign(
        obj,
        secret,
        {expiresIn: expiry}
    );
}

const createHMAC = (salt, secret) => {
    return crypto.createHmac('sha256', secret)
        .update(salt)
        .digest('hex');
}
const verifyJWT = (obj, secret) => {
    if(!secret){
        secret=config.secret
    }
    return jwt.verify(
        obj,
        secret
    );
}

module.exports = {
    cryptPassword,
    comparePassword,
    generateSessionID,
    createJwtToken,
    verifyJWT,
    getBase64,
    getStringFromBase64,
    createHMAC
}
