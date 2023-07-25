import {translate} from "../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import {handleWebhookEvent, verifyPayment} from "../../helpers/transactionHelper";
import Transaction from "../../db/models/transaction";
import Appointment from "../../db/models/appointment";
import {addByInfo} from "../../helpers/modelHelper";
import {initiateNotifications} from "../../helpers/notificationHelper";
import * as config from "../../config/config";
import {useCoupon} from "../../helpers/couponHelper";

const index = (req, res) => {
    const translator = translate(req.headers.lang);

    Transaction.find({}).sort({created_at: 1}).then(transactions => {
        return jsonResponse(
            res,
            transactions,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

}


const confirmPaymentCallback = async (req, res) => {
    const translator = translate(req.headers.lang);
    let {transaction_id} = req.query
    let {razorpay_payment_id, razorpay_order_id, razorpay_signature} = req.body
    if (verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
        let transaction = await Transaction.findOneAndUpdate({_id: transaction_id},
            {razorpay_payment_id: razorpay_payment_id, razorpay_signature: razorpay_signature})
        await Appointment.findOneAndUpdate({_id: transaction.appointment}, {status: "scheduled"})
    }
    return jsonResponse(
        res,
        null,
        translator.__("update_success"),
        200
    );
}
const paymentWebhook = async (req, res) => {
    const translator = translate(req.headers.lang);
    handleWebhookEvent(req.body)
    return jsonResponse(
        res,
        null,
        translator.__("update_success"),
        200
    );
}

const confirmPayment = async (req, res) => {
    const translator = translate(req.headers.lang);
    let {razorpay_payment_id, razorpay_order_id, razorpay_signature, transaction_id} = req.body
    if (verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
        let transaction = await Transaction.findOne({_id: transaction_id})
        if (!transaction) {
            return errorResponse("Invalid transaction id.", res, 400)
        }
        let appointment_data = await Appointment.findOne({_id: transaction.appointment, status: "reserved"})
        addByInfo(transaction, res.locals.user, false)
        transaction.razorpay_order_id = razorpay_order_id
        transaction.razorpay_payment_id = razorpay_payment_id
        transaction.razorpay_signature = razorpay_signature
        await transaction.save()
        let promises = []
        if (appointment_data) {
            appointment_data.status = "scheduled"
            promises.push(appointment_data.save())
            if (appointment_data.coupon) {
                promises.push(useCoupon(appointment_data.coupon, appointment_data._id, appointment_data.patient))
            }
            promises.push(initiateNotifications(appointment_data, config.constants.NOTIFICATION_TYPE.APPOINTMENT_BOOKING))
        }

        await Promise.all(promises)
        return jsonResponse(
            res,
            null,
            translator.__("update_success"),
            200
        );
    } else
        return errorResponse("There was an error confirming payment.", res, 400)


}
module.exports = {
    confirmPayment,
    confirmPaymentCallback,
    paymentWebhook,
    index
}
