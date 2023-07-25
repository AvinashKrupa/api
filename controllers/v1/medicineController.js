import {translate} from "../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import Medicine from "../../db/models/medicine";
import Medicinetype from "../../db/models/medicinetype";
import {validate} from "../../helpers/validator";
import {HandleError} from "../../helpers/errorHandling";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        name: "required",
        type: "required",
        status: "required"
    };
    validate(req.query, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {name, type, status} = req.query;
            Medicine.find({name: new RegExp('.*' + name + '.*'), type: type, status: status}, {
                _id: 1,
                name: 1,
                type: 1
            }).limit(20).then(medicines => {
                return jsonResponse(
                    res,
                    medicines,
                    translator.__("retrieve_success"),
                    200
                );
            }).catch((e) => {
                return errorResponse(e, res, e.code);
            });
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}
const getMedicineTypes = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        status: "required",
    };
    validate(req.query, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {status} = req.query;
            Medicinetype.find({status: status}, {_id: 1, name: 1, status: 1}).then(medicineTypes => {
                return jsonResponse(
                    res,
                    medicineTypes,
                    translator.__("retrieve_success"),
                    200
                );
            }).catch((e) => {
                return errorResponse(e, res, e.code);
            });
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

module.exports = {
    index,
    getMedicineTypes,
}
