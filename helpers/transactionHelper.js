import {createHMAC} from "./hashHelper";
import Transaction from "../db/models/transaction";
import {initiateNotifications} from "./notificationHelper";
import Razorpay from "razorpay"
import Appointment from "../db/models/appointment";
import * as config from "../config/config";
import {useCoupon} from "./couponHelper";

let moment = require('moment-timezone');
require('dotenv').config()

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});


export const createOrder = (options) => {
    return instance.orders.create(options).then(order => {
        return Promise.resolve(order)
    })
}
export const createPaymentLink = (options) => {
    return instance.paymentLink.create({
        ...options,
        accept_partial: false,
        expire_by: moment().add(16, "minutes").unix(),
        description: "Appointment Fee",
        notify: {
            sms: true,
            email: true
        },
        reminder_enable: true,
    })
}

export const verifyPayment = (order_id, razorpay_payment_id, razorpay_signature) => {
    let generated_signature = createHMAC(order_id + "|" + razorpay_payment_id, process.env.RAZORPAY_KEY_SECRET);
    return generated_signature === razorpay_signature
}

export const handleWebhookEvent = async (reqBody) => {
    let appointment_id, appointment_data;
    switch (reqBody.event) {
        case "order.paid":
            let orderEntity = reqBody.payload.order.entity
            let paymentEntity = reqBody.payload.payment.entity
            let orderStatus = orderEntity.status
            switch (orderStatus) {
                case "paid":
                    //TODO: Update transaction status as well as appointment status
                    await Transaction.findOneAndUpdate({
                        appointment: orderEntity.notes.appointment,
                        status: "initiated"
                    }, {
                        status: "order_paid",
                        razorpay_payment_id: paymentEntity.id
                    })
                    appointment_data = await Appointment.findOne({_id: orderEntity.notes.appointment})
                    if (!appointment_data)
                        break;
                    if (appointment_data.status === "cancelled") {
                        /*
                        This appointment got cancelled and no longer is valid, hence this payment confirmation is invalid
                        Initiate refund from here
                         */
                        let refundObj = {}
                        refundObj.amount = appointment_data.fee* 100;  // Amount in paise. The amount to be refunded (in the smallest unit of currency).
                        refundObj.notes = {
                            appointment: String(appointment_data._id),
                            patient: String(appointment_data.patient),
                            cancellation_of_appointment: "Refunding for the patient due to cancellation of the appointment.",
                        };
                        await initiateNotifications(appointment_data, config.constants.NOTIFICATION_TYPE.APPOINTMENT_BOOKING_FAILED)
                        await initiateRefund(paymentEntity.id,refundObj)
                    } else if (appointment_data.status === "reserved") {
                        appointment_data.status="scheduled"
                        let promises = [appointment_data.save()]

                        if (appointment_data.coupon) {
                            promises.push(useCoupon(appointment_data.coupon, appointment_data._id, appointment_data.patient))
                        }
                        promises.push(initiateNotifications(appointment_data, config.constants.NOTIFICATION_TYPE.APPOINTMENT_BOOKING))
                        await Promise.all(promises)
                    }
                    break;
            }
            break;
        case "payment.failed":
            //TODO: Update transaction status in transaction table
            break;
        case "payment.captured":
            //TODO: Update transaction status in transaction table
            break;
        case "refund.processed":
            appointment_id = reqBody.payload.refund.entity.notes.appointment;

            //Update transaction status in transaction table
            await Transaction.findOneAndUpdate({
                appointment: appointment_id,
            }, {status: "refund_processed"});

            // Sending push notification to the patient user
            await initiateNotifications(appointment_id, config.constants.NOTIFICATION_TYPE.APPOINTMENT_REFUND_PROCESSED)

            break;
        case "refund.failed":
            appointment_id = reqBody.payload.refund.entity.notes.appointment;
            //Update transaction status in transaction table
            await Transaction.findOneAndUpdate({
                appointment: appointment_id,
            }, {status: "refund_failed"});
            break;
        case "refund.created":
            appointment_id = reqBody.payload.refund.entity.notes.appointment;
            //Update transaction status in transaction table
            await Transaction.findOneAndUpdate({
                appointment: appointment_id,
            }, {status: "refund_created"});
            break;
    }
}

export const initiateRefund = (payment_id, refundObj) => {
    return instance.payments.refund(payment_id, refundObj).then(payment_refund => {
        return Promise.resolve(payment_refund)
    })
}
