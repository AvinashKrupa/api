import {translate} from "../../../helpers/multilingual";
import Video from "../../../db/models/video";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import {uploadFile, deleteFile} from "../../../helpers/s3FileUploadHelper";
import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";
import {setAttributes} from "../../../helpers/modelHelper";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    let {showAll = false} = req.query
    let matchCond = showAll ? {} : {status: "active"}
    Video.find(matchCond).sort({title: 1}).then(results => {
        return jsonResponse(
            res,
            results,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

}
const addNew = (req, res) => {
    const translator = translate(req.headers.lang);
     
    if (!req.files.file) {
        return errorResponse("Please provide a valid video file", res, 400);
    }
    if (!req.files.thumb_file) {
        return errorResponse("Please provide a valid thumbnail file", res, 400);
    }
    const validations = {
        title: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            
            await uploadFile(req.files.thumb_file.pop(), 'video').then(async result => {
                req.body.thumb_url = result.Location
            })

            return await uploadFile(req.files.file.pop(), 'video').then(async result => {
                let model = new Video()
                req.body.url = result.Location               
                setAttributes(req.body, res.locals.user, model, true)
                model = await model.save()
                return jsonResponse(
                    res,
                    model,
                    translator.__("upload_success"),
                    200
                );
            })
            
        }).catch((e) => {

        return errorResponse(e, res, e.code);
    });
}

const changeStatus = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        status: "required",
        _id: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {status, _id} = req.body

            let model = await Video.findOneAndUpdate({_id: _id}, {status: status, updated_by: res.locals.user._id})

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
            let video = await Video.findOne({_id: _id})
            await deleteFile(video.thumb_url, 'video').then(async result => {})
            return await deleteFile(video.url, 'video').then(async result => {
                await Video.delete({_id: _id})
                return jsonResponse(
                    res,
                    null,
                    translator.__("delete_success"),
                    200
                );
            })
        }).catch((e) => {

        return errorResponse(e, res, e.code);
    });
}
module.exports = {
    index,
    addNew,
    deleteRecord,
    changeStatus
}
