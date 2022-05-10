import {translate} from "../../../helpers/multilingual";
import Coupon from "../../../db/models/coupon";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";
import {setAttributes} from "../../../helpers/modelHelper";
import {getFinalAmount} from "../../../helpers/couponHelper";
import {getEndOfDateInUTC, getStartOfDateInUTC} from "../../../helpers/timeHelper";

import * as config from "../../../config/config";
import {createAdminLog} from "../../../helpers/adminlogHelper";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    Coupon.find().sort({title: 1}).then(coupons => {
        return jsonResponse(
            res,
            coupons,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

}

const update = (req, res) => {
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
            let model = await Coupon.findOne({_id: _id})
            if (!model) {
                throw new HandleError("Cannot find coupon with mentioned id", 400);
            }
            setAttributes(req.body, res.locals.user, model, true)
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
        _id: "required",
        status: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {_id, status} = req.body
            let model = await Coupon.findOne({_id: _id})
            if (!model) {
                throw new HandleError("Cannot find coupon with mentioned id", 400);
            }
            model.status = status
            model.updated_by = res.locals.user._id
            model = await model.save();
            //Using to record the log for the admin who is changing status of it.
            let logData = {};
            logData.user_id = res.locals.user._id;
            logData.module_name = config.constants.LOG_MSG_MODULE_NAME.COUPON
            logData.title = config.constants.LOG_MSG_TITLE.COUPON_STATUS_CHANGED;
            logData.message = config.constants.LOG_MESSAGE.COUPON_STATUS_CHANGED;
            logData.message = logData.message.replace('{{admin}}', res.locals.user.first_name +' '+ res.locals.user.last_name);
            logData.message = logData.message.replace('{{status}}', status);
            logData.record_id =  _id;
            await createAdminLog(logData);


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
const addNew = (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    const validations = {
        code: "required",
        desc: "required",
        discount_pct: "required",
        start_date: "required",
        end_date: "required",
        max_usages: "required",
        coupon_type : "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {code, start_date, end_date} = req.body
            start_date = getStartOfDateInUTC(start_date, timezone)
            end_date = getEndOfDateInUTC(end_date, timezone)

            let existing = await Coupon.find({
                code: code, $or: [
                    {
                        start_date: {
                            $lte: end_date,
                            $gte: start_date
                        }
                    },
                    {
                        end_date: {
                            $lte: end_date,
                            $gte: start_date
                        }
                    }
                ]
            })
            if (existing && existing.length > 0) {
                return errorResponse("Code already exists for specified date range.", res, 400)
            }
            let model = new Coupon()
            setAttributes(req.body, res.locals.user, model, true, ["start_date", "end_date"])
            model.start_date = start_date
            model.end_date = end_date
            model = await model.save();
            //Using to record the log for the admin who is creating it.
            let logData = {};
            logData.user_id = res.locals.user._id;
            logData.module_name = config.constants.LOG_MSG_MODULE_NAME.COUPON
            logData.title = config.constants.LOG_MSG_TITLE.COUPON_CREATED;
            logData.message = config.constants.LOG_MESSAGE.COUPON_CREATED;
            logData.message = logData.message.replace('{{admin}}', res.locals.user.first_name +' '+ res.locals.user.last_name);
            logData.message = logData.message.replace('{{coupon_code_name}}', code);
            logData.message = logData.message.replace('{{for_use}}', coupon_type);
            logData.record_id =  model._id;
            await createAdminLog(logData);
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

            await Coupon.delete({_id: _id})

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
const checkDiscount = async (req, res) => {
    const validations = {
        appointment_id: "requiredWithout:fee",
        fee: "requiredWithout:appointment_id",
        code: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {fee, code,patient_id} = req.body
            let message = "Coupon validated."

            return getFinalAmount(fee, code, patient_id?patient_id:res.locals.user.selected_profile_id).then(result => {
                return jsonResponse(
                    res,
                    {
                        final_amount: result.final_amount,
                        code: result.coupon.code,
                        desc: result.coupon.desc,
                        discount_pct: result.coupon.discount_pct,
                        discount: result.discount
                    },
                    message,
                    200
                );
            })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
};
module.exports = {
    index,
    addNew,
    deleteRecord,
    checkDiscount,
    update,
    changeStatus
}
