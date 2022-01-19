import {translate} from "../../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import Language from "../../../db/models/language";
import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    let {showAll = false} = req.query
    let matchCond = showAll ? {} : {enabled: true}
    Language.find(matchCond).sort({name:1}).then(langs => {
        return jsonResponse(
            res,
            langs,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

}
const addNew = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        name: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let model = new Language()
            model.name = req.body.name
            model = await model.save()
            return jsonResponse(
                res,
                model,
                translator.__("create_success"),
                200
            );
        }).catch((e) => {

        return errorResponse(e, res, e.code);
    });
}
const update = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        name: "required",
        _id: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {name, _id} = req.body
            let updateContent = {name: name}

            let model = await Language.findOneAndUpdate({_id: _id}, updateContent)

            return jsonResponse(
                res,
                model,
                translator.__("update_success"),
                200
            );

        }).catch((e) => {

        return errorResponse(e, res, e.code);
    });

}
const changeStatus = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        enabled: "required",
        _id: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {enabled, _id} = req.body

            let model = await Language.findOneAndUpdate({_id: _id}, {enabled: enabled})

            return jsonResponse(
                res,
                model,
                translator.__("update_success"),
                200
            );

        }).catch((e) => {

        return errorResponse(e, res, e.code);
    });
}
const deleteRecord = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        _id: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {_id} = req.body

             await Language.delete({_id:_id})

            return jsonResponse(
                res,
                null,
                translator.__("delete_success"),
                200
            );

        }).catch((e) => {

        return errorResponse(e, res, e.code);
    });
}
module.exports = {
    index,
    addNew,
    update,
    deleteRecord,
    changeStatus
}
