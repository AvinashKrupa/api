import {translate} from "../../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import Qualification from "../../../db/models/qualification";
import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    let {showAll = false} = req.query
    let matchCond = showAll ? {} : {enabled: true}
    Qualification.find(matchCond)
        .populate({path:"category", select:"title",options:{withDeleted:true}})
        .sort({name: 1, category: 1}).then(quals => {
        return jsonResponse(
            res,
            quals,
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
        category: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {name, category} = req.body
            let model = new Qualification()
            model.name = name
            model.category = category
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
        category: "required",
        _id: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {name, _id,category} = req.body
            let updateContent = {name: name,category:category}

            let model = await Qualification.findOneAndUpdate({_id: _id}, updateContent)

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

            let model = await Qualification.findOneAndUpdate({_id: _id}, {enabled: enabled})

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

            await Qualification.delete({_id:_id})

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
