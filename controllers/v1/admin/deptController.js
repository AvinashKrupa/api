import {translate} from "../../../helpers/multilingual";
import Department from "../../../db/models/department";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    let {showAll = false} = req.query
    let matchCond = showAll ? {} : {enabled: true}
    Department.find(matchCond).sort({title: 1}).then(departments => {
        return jsonResponse(
            res,
            departments,
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
        title: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let model = new Department()
            model.title = req.body.title
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
        title: "required",
        _id: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {title, _id} = req.body
            let updateContent = {title: title}

            let model = await Department.findOneAndUpdate({_id: _id}, updateContent)

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

            let model = await Department.findOneAndUpdate({_id: _id}, {enabled: enabled})

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

           await Department.delete({_id:_id})

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
