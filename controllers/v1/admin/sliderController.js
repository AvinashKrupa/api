import {translate} from "../../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import Slider from "../../../db/models/slider";
import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";
import {uploadFile} from "../../../helpers/s3FileUploadHelper";
import {setAttributes} from "../../../helpers/modelHelper";
import {getArrayFromFilterParams} from "../../../helpers/controllerHelper";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    let {showAll = false} = req.query
    let matchCond = showAll ? {} : {enabled: true}
    Slider.find(matchCond).populate("speciality", "speciality_id")
    .sort({title: 1}).then(sliders => {
        return jsonResponse(
            res,
            sliders,
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
        type: "required",
        user_type: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            return uploadFile(req.file, "slider").then(async result => {
                let model = new Slider()
                setAttributes(req.body, res.locals.user, model, true)
                model.image = result.Location
                model = await model.save()
                return jsonResponse(
                    res,
                    model,
                    translator.__("create_success"),
                    200
                );
            })
        }).catch((e) => {

        return errorResponse(e, res, e.code);
    });
}

const addNewMulti = async (req, res) => {
    const translator = translate(req.headers.lang);
    if (!req.files || req.files.length === 0) {
        return errorResponse("Please provide a valid file", res, 400);
    }
    const validations = {
        title: "required",
        type: "required",
        user_type: "required",
        device_type: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {device_type} = req.body

            device_type = getArrayFromFilterParams(device_type, false)
            let promises = []
            let model = new Slider()
            setAttributes(req.body, res.locals.user, model, true, ["device_type"])
            for (let i = 0; i < req.files.length; i++) {
                let file = req.files[i]
                promises.push(uploadFile(file, "slider").then(result => {
                    if (device_type[i] == "mobile")
                        model.mob_image = result.Location
                    else
                        model.image = result.Location
                }))
            }
            await Promise.all(promises)
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
};
const update = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        title: "required",
        type: "required",
        user_type: "required",
        _id: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {device_type} = req.body
            device_type = getArrayFromFilterParams(device_type, false)
            let promises = []
            let model = await Slider.findOneWithDeleted({_id: req.body._id}).then(result => {
                return Promise.resolve(result)
            })
            if (!model) {
                throw new HandleError("Cannot find record", 400)
            }
            setAttributes(req.body, res.locals.user, model, false, ["device_type"])
            for (let i = 0; i < req.files.length; i++) {
                let file = req.files[i]
                promises.push(uploadFile(file, "slider").then(result => {
                    if (device_type[i] == "mobile")
                        model.mob_image = result.Location
                    else
                        model.image = result.Location
                }))
            }
            await Promise.all(promises);
            if (req.body.speciality_id === "" || req.body.speciality_id === 'null') {
                model.speciality_id = undefined;
            }
            model = await model.save()
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

            let model = await Slider.findOneAndUpdate({_id: _id}, {enabled: enabled})

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

            await Slider.delete({_id: _id})

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
    changeStatus,
    addNewMulti
}
