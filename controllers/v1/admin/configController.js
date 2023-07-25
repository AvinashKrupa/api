import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import Configuration from "../../../db/models/configuration";
import {translate} from "../../../helpers/multilingual";
import * as _ from "lodash";


const index = async (req, res) => {
    const translator = translate(req.headers.lang);

    return Configuration.find().then(configs => {
        return jsonResponse(
            res,
            configs,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {

        return errorResponse(e, res, e.code);
    });


}
const update = async (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {config_id: "requiredWithout:name", name: "requiredWithout:config_id", value: "required"};
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {config_id, value, name} = req.body
            return Configuration.findOneAndUpdate({$or: [{_id: config_id}, {name: name}]}, {$set: {value: value}}, {new: true}).then(result => {
                return jsonResponse(
                    res,
                    result,
                    translator.__("update_success"),
                    200
                );
            })


        })
        .catch((e) => {

            return errorResponse(e, res, e.code);
        });


}
const getAboutUs = async (req, res) => {
    let aboutUs = await Configuration.findOne({name: "about_us"})
    return res.send(aboutUs.value)
}

const getDetails = async (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {config_id: "requiredWithout:name", name: "requiredWithout:config_id",};
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {config_id, name} = req.body
            return Configuration.findOne({$or: [{_id: config_id}, {name: name}]}).then(config => {
                if (config) {

                    return jsonResponse(
                        res,
                        config,
                        translator.__("retrieve_success"),
                        200
                    );
                } else {
                    return errorResponse("Cannot find config", res, 400);
                }
            })


        })
        .catch((e) => {

            return errorResponse(e, res, e.code);
        });


}
const getCurrentVersions = async (req, res) => {
    const translator = translate(req.headers.lang);
    return Configuration.findOne({name: "versions"}).then(config => {
        if (config) {
            return jsonResponse(
                res,
                JSON.parse(config.value),
                translator.__("retrieve_success"),
                200
            );
        } else {
            return errorResponse("Cannot find version config", res, 400);
        }
    })

}

const updateVersion = async (req, res) => {
    const translator = translate(req.headers.lang);

    let config = await Configuration.findOne({name: "versions"})
    let configObj = JSON.parse(config.value)
    let value = _.merge({}, configObj, req.body)
    return Configuration.findOneAndUpdate({name: "versions"}, {$set: {value: JSON.stringify(value)}}, {new: true})
        .then(result => {
            return jsonResponse(
                res,
                JSON.parse(result.value),
                translator.__("update_success"),
                200
            );
        }).catch((e) => {
            return errorResponse(e, res, e.code);
        });


}


module.exports = {
    update,
    getDetails,
    index,
    getCurrentVersions,
    updateVersion,
    getAboutUs
}
