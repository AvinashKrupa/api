/*
@data: Object
@message: String
@status: Integer
@httpCode: Integer
*/
const _ = require('lodash');

let jsonResponse = (res, data, message, code, httpCode = 200) => {
    return res.status(httpCode).json({
        status: code,
        data: data,
        message: message,
    });
};

const errorToJson = (error) => {
    let result;
    if (_.isString(error)) {
        result = {
            message: error,
            status: 400
        };
        return result
    } else {
        result = {
            ...error,
            message: (error.message) ? error.message : '' + error,
            status: error.status
        };
        delete result.toJSON
        delete result.result
        return result
    }
}

const errorResponse = (e, res, httpCode = 400, normalize = true) => {
    if (httpCode < 100 || httpCode > 599)
        httpCode = 400
    if (!_.isString(e)) {
        res.status(httpCode).json(errorToJson({
            ...e,
            message: normalizeError(e),
            status: httpCode,
        }))

    } else {
        res.status(httpCode).json(errorToJson(e))
    }

}
const normalizeError = error => {
    if (error.errors) {
        let arr = []
        for (let key of Object.keys(error.errors)) {
            arr.push(error.errors[key].message)
        }
        return `${arr.join(' and ')}`
    } else if (error.error) {
        if (_.isString(error.error))
            return error.error
        else if (_.isObject(error.error) && error.error.description) {
            return error.error.description
        }
        return error.error
    } else if (error.message && _.isObject(error.message)) {
        let arr = []
        for (let key of Object.keys(error.message)) {
            arr.push(error.message[key].message)
        }
        return `${arr.join(' and ')}`
    }
    return error.message
}
const stringToHTML = function (str) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, 'text/html');
    return doc.body;
};
let printResponse = (
    res,
    id,
    processed,
    data,
    warnings,
    errors,
    httpCode = 200
) => {
    return res.status(httpCode).json({
        id: id,
        processed: processed,
        data: data,
        warnings: warnings ? warnings : [],
        errors: errors ? errors : [],
    });
};

module.exports = {
    jsonResponse,
    printResponse,
    errorResponse,
    stringToHTML
};
