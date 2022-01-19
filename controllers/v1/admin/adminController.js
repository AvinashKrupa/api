import {validate} from "../../../helpers/validator";
import {HandleError} from "../../../helpers/errorHandling";
import User from "../../../db/models/user";
import Patient from "../../../db/models/patient";
import Doctor from "../../../db/models/doctor";
import Report from "../../../db/models/report";
import Appointment from "../../../db/models/appointment";
import Transaction from "../../../db/models/transaction";
import Prescription from "../../../db/models/prescription";
import Conversation from "../../../db/models/conversation";
import Notification from "../../../db/models/notification";
import Message from "../../../db/models/message";
import {errorResponse, jsonResponse} from "../../../helpers/responseHelper";
import {translate} from "../../../helpers/multilingual";
import {prepareAppointmentModel} from "../../../helpers/appointmentHelper";
import {addByInfo} from "../../../helpers/modelHelper";
import {createPaymentLink} from "../../../helpers/transactionHelper";

const cleanupUserRecords = async (req, res) => {
    const validations = {mobile_number: "required"};
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {mobile_number} = req.body
            let message = "Cannot find user to delete."
            let user = await User.findOne({mobile_number: mobile_number})
            if (user) {
                let patientId = await Patient.findOne({user_id: user._id}, {_id: 1})
                let docId = await Doctor.findOne({user_id: user._id}, {_id: 1})
                let matchCond = {}
                if (patientId) {
                    matchCond = {...matchCond, patient: patientId}
                    await Report.deleteMany({patient: patientId})
                    await Patient.deleteOne({_id: patientId})
                }
                if (docId) {
                    matchCond = {...matchCond, doctor: docId}
                    await Doctor.deleteOne({_id: docId})
                }
                if (Object.keys(matchCond).length > 0) {
                    let ids = []
                    let prescriptions = []
                    await Appointment.find(matchCond, {_id: 1, prescription: 1}).then(results => {
                        if (results && results.length > 0) {
                            results.forEach(result => {
                                ids.push(result._id)
                                if (result.prescription && result.prescription.length > 0) {
                                    result.prescription.forEach(pres => {
                                        prescriptions.push(pres)
                                    })
                                }
                            })
                        }

                    })
                    if (ids && ids.length > 0) {
                        await Transaction.deleteMany({appointment: {$in: ids}})
                        await Appointment.deleteMany({_id: {$in: ids}})
                    }
                    if (prescriptions && prescriptions.length > 0) {
                        await Prescription.deleteMany({_id: {$in: prescriptions}})
                    }
                }
                await Notification.deleteMany({user_id: user._id})
                let convIds = []
                let rooms = []
                await Conversation.find({participants: user._id}).then(convs => {
                    if (convs && convs.length > 0) {
                        convs.forEach(conv => {
                            convIds.push(conv._id)
                            rooms.push(conv.room_id)
                        })
                    }
                })
                if (rooms.length > 0) {
                    await Message.deleteMany({room_id: {$in: rooms}})
                }
                if (convIds.length > 0) {
                    await Conversation.deleteMany({_id: {$in: convIds}})
                }
                await User.deleteOne({mobile_number: mobile_number})
                message = "Cleanup done."
            }

            return jsonResponse(
                res,
                null,
                message,
                200
            );

        })
        .catch((e) => {

            return errorResponse(e, res, e.code);
        });


}
const bookAppointment = async (req, res) => {
    const translator = translate(req.headers.lang);
    let {timezone = "Asia/Calcutta"} = req.headers
    const validations = {
        doctor_id: "required",
        patient_id: "required",
        slot_id: "required",
        date: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let appointment
            try {
                appointment = await prepareAppointmentModel({
                    ...req.body,
                    timezone: timezone,
                    created_by: res.locals.user
                })
            } catch (e) {
                throw new HandleError(e, 400)
            }
            if (appointment.status == "scheduled")
                return jsonResponse(
                    res,
                    appointment,
                    translator.__("create_success"),
                    200
                )
            await Transaction.deleteOne({appointment: appointment._id, status: "initiated"})
            let patient = await Patient.findOne({_id: appointment.patient}, {user_id: 1})
            return createPaymentLink({
                amount: appointment.fee * 100,
                currency: appointment.currency,
                customer: {
                    name: patient.user_id.first_name + " " + patient.user_id.last_name,
                    email: patient.user_id.email,
                    contact: patient.user_id.mobile_number
                },
                notes:{appointment:appointment._id.toString()}
            }).then(async link => {
                let transaction = new Transaction()
                transaction.appointment = appointment._id
                transaction.razorpay_payment_link_id = link.id
                addByInfo(transaction, res.locals.user)
                await transaction.save()

                return jsonResponse(
                    res,
                    appointment,
                    translator.__("create_success"),
                    200
                )
            })
        }).catch((e) => {
        console.log("error>>", JSON.stringify(e))
        return errorResponse(e, res, e.code);
    });
};
module.exports = {
    cleanupUserRecords,
    bookAppointment
}
