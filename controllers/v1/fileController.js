import {translate} from "../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import {getPresignedUrl, uploadFile} from "../../helpers/s3FileUploadHelper";
import User from "../../db/models/user";
import {isValidObjectId} from "mongoose";
import {validate} from "../../helpers/validator";
import {HandleError} from "../../helpers/errorHandling";

const fileUpload = (req, res) => {
    const translator = translate(req.headers.lang);
    if (!req.file) {
        return errorResponse("Please provide a valid file", res, 400);
    }
    const validations = {
        id: "validObjectId",
        type: "required"
    }
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }

            return uploadFile(req.file, req.body.type).then(async result => {
                if (req.body.id && isValidObjectId(req.body.id)) {
                    // There is id associated with this file, save it accordingly
                    switch (req.body.type) {
                        case "profile":
                            await User.findOneAndUpdate({_id: req.body.id}, {dp: result.Location})
                    }
                }
                return jsonResponse(
                    res,
                    {url: result.Location},
                    translator.__("upload_success"),
                    200
                );
            })
        }).catch((e) => {

        return errorResponse(e, res, e.code);
    });
}
const getPublicLinkFile = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        file_url: "required",
    }
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }

            let fileUrl = getPresignedUrl(req.body.file_url)
            return jsonResponse(
                res,
                {url: fileUrl},
                translator.__("retrieve_success"),
                200
            );
        }).catch((e) => {

        return errorResponse(e, res, e.code);
    });
}

module.exports = {
    fileUpload,
    getPublicLinkFile
}
