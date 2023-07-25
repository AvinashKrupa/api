import {translate} from "../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import {getPresignedUrl, uploadFile} from "../../helpers/s3FileUploadHelper";
import User from "../../db/models/user";
import {isValidObjectId} from "mongoose";
import {validate} from "../../helpers/validator";
import {HandleError} from "../../helpers/errorHandling";
import Doctor from "../../db/models/doctor";

const path = require('path');
const fs = require("fs");

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

const uploadFileFromLocalDirToS3 = (req, res) => {
    const validations = {
    }
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            const folderPath = path.resolve(__dirname + '/../../../digital_signatures');
            const isFile = fileName => {
                return fs.lstatSync(fileName).isFile()
            }
            let files_path_data =  fs.readdirSync(folderPath).map(fileName => {
                return path.join(folderPath, fileName);
            })
            .filter(isFile)
            
            for await (const file_path of files_path_data) {
                let file_data = {};
                file_data.buffer = fs.readFileSync(file_path);
                const key = file_path.substring(file_path.lastIndexOf('/')+1);
                file_data.originalname = key;
                let split_file_name = file_data.originalname.split('.');
                let mobile_number = split_file_name[0];
                let user_data = await User.findOne({"mobile_number": mobile_number});
                if(user_data) {
                    let doctor_data = await Doctor.findOne({user_id: user_data._id});
                    if(doctor_data) {
                        let result = await uploadFile(file_data, "signatures");
                        await Doctor.findOneAndUpdate({user_id: user_data._id}, {digital_signature_url: result.Location});
                    } else {
                        //console.log('Doctor record not found to update the digital signature.');
                    }
                } else {
                    //console.log('User not found!');
                }
            }
            return jsonResponse(
                res,
                {},
                'uploaded successfully',
                200
            );
        }).catch((e) => {
            console.log('error->', e);
            return errorResponse(e, res, e.code);
        });
}

module.exports = {
    fileUpload,
    getPublicLinkFile,
    uploadFileFromLocalDirToS3
}
