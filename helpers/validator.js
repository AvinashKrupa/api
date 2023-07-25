import {isValidObjectId} from "mongoose";

const niv = require("node-input-validator");
// second params will be the instance of Validator
niv.extend("validObjectId", ({value}) => {
    return isValidObjectId(value)
}, true);
niv.extend("intParsableString", ({value}) => {
    return isValidObjectId(value)
}, true);

module.exports.validate = async (data, fieldsToCheck) => {
    const v = new niv.Validator(data, fieldsToCheck);
    const matched = await v.check();
    if (!matched) {
        return {status: false, data: v.errors};
    } else {
        return {status: true, data: {}};
    }
};
