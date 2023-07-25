import {translate} from "../../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import Speciality from "../../../db/models/speciality";
import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";
import {uploadFile} from "../../../helpers/s3FileUploadHelper";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    let {showAll = false} = req.query
    let matchCond = showAll ? {} : {enabled: true}
    Speciality.find(matchCond).sort({title: 1}).then(specialities => {
        return jsonResponse(
            res,
            specialities,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

}
const addNew = (req, res) => {
    const translator = translate(req.headers.lang);
    if (!req.file) {
        return errorResponse("Please provide a valid file", res, 400);
    }
    const validations = {
        title: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            return uploadFile(req.file, "speciality").then(async result => {
                let speciality = new Speciality()
                speciality.title = req.body.title
                speciality.image = result.Location
                speciality = await speciality.save()
                return jsonResponse(
                    res,
                    speciality,
                    translator.__("create_success"),
                    200
                );
            })
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
            let url
            if (req.file) {
                url = await uploadFile(req.file, "speciality").then(result => {
                    return Promise.resolve(result.Location)
                })
            }
            if (url) {
                updateContent = {...updateContent, image: url}
            }
            let speciality = await Speciality.findOneAndUpdate({_id: _id}, updateContent)

            return jsonResponse(
                res,
                speciality,
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

            let speciality = await Speciality.findOneAndUpdate({_id: _id}, {enabled: enabled})

            return jsonResponse(
                res,
                speciality,
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

            await Speciality.delete({_id:_id})

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
