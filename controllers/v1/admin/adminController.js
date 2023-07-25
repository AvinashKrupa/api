import { validate } from "../../../helpers/validator";
import { HandleError } from "../../../helpers/errorHandling";
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
import { errorResponse, jsonResponse } from "../../../helpers/responseHelper";
import { translate } from "../../../helpers/multilingual";
import { prepareAppointmentModel } from "../../../helpers/appointmentHelper";
import { addByInfo } from "../../../helpers/modelHelper";
import { createPaymentLink } from "../../../helpers/transactionHelper";
import { updateAdmin } from "../../../helpers/userHelper";
import {cryptPassword} from "../../../helpers/hashHelper";

import * as config from "../../../config/config";
import {createAdminLog} from "../../../helpers/adminlogHelper";

import {sendPushNotificationToMultiple} from "../../../helpers/fcmHelper";
import {createMultipleNotification} from "../../../helpers/notificationHelper";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    let {limit = 20, page = 1} = req.body;
    let sort_key = "created_at"
    let sort_order = "desc"
    let skipAndLimit = []
    if (typeof limit !== 'undefined') {
        skipAndLimit = [{$skip: limit * (page - 1)},
            {$limit: limit}]
    } else {
        skipAndLimit = [{$skip: 0}]
    }
    let matchCond = {profile_types:{$elemMatch:{$eq:"3"}}}
    return User.aggregate([
        {$match: matchCond},
        {
            $sort: {
                [sort_key]: sort_order === "asc" ? 1 : -1
            }
        },
        {
            $facet: {
                metadata: [{$count: "total"}],
                docs: skipAndLimit
            }
        }
    ]).then(results => {
        let result = results[0]
        let finalResult = {};
        finalResult.docs = result.docs
        finalResult.total = result && result.metadata[0] ? result.metadata[0].total : 0;
        finalResult.limit = limit;
        finalResult.page = page;
        finalResult.sort_key = sort_key;
        finalResult.sort_order = sort_order;
        return jsonResponse(
            res,
            finalResult,
            translator.__("retrieve_success"),
            200
        );
    }).catch(error => errorResponse(error, res)); 
}

const cleanupUserRecords = async (req, res) => {
    const validations = { mobile_number: "required" };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let { mobile_number } = req.body
            let message = "Cannot find user to delete."
            let user = await User.findOne({ mobile_number: mobile_number })
            if (user) {
                let patientId = await Patient.findOne({ user_id: user._id }, { _id: 1 })
                let docId = await Doctor.findOne({ user_id: user._id }, { _id: 1 })
                let matchCond = {}
                if (patientId) {
                    matchCond = { ...matchCond, patient: patientId }
                    await Report.deleteMany({ patient: patientId })
                    await Patient.deleteOne({ _id: patientId })
                }
                if (docId) {
                    matchCond = { ...matchCond, doctor: docId }
                    await Doctor.deleteOne({ _id: docId })
                }
                if (Object.keys(matchCond).length > 0) {
                    let ids = []
                    let prescriptions = []
                    await Appointment.find(matchCond, { _id: 1, prescription: 1 }).then(results => {
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
                        await Transaction.deleteMany({ appointment: { $in: ids } })
                        await Appointment.deleteMany({ _id: { $in: ids } })
                    }
                    if (prescriptions && prescriptions.length > 0) {
                        await Prescription.deleteMany({ _id: { $in: prescriptions } })
                    }
                }
                await Notification.deleteMany({ user_id: user._id })
                let convIds = []
                let rooms = []
                await Conversation.find({ participants: user._id }).then(convs => {
                    if (convs && convs.length > 0) {
                        convs.forEach(conv => {
                            convIds.push(conv._id)
                            rooms.push(conv.room_id)
                        })
                    }
                })
                if (rooms.length > 0) {
                    await Message.deleteMany({ room_id: { $in: rooms } })
                }
                if (convIds.length > 0) {
                    await Conversation.deleteMany({ _id: { $in: convIds } })
                }
                await User.deleteOne({ mobile_number: mobile_number })
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
    let { timezone = "Asia/Calcutta" } = req.headers
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

            let patient = await Patient.findOne({ _id: appointment.patient }, { user_id: 1 });
            let doctor = await Doctor.findOne({ _id: appointment.doctor }, { first_name:1, last_name:1 });
            //Using to record the log for the admin who is booking appointment for the patient.
            let logData = {};
            logData.user_id = res.locals.user._id;
            logData.module_name = config.constants.LOG_MSG_MODULE_NAME.APPOINTMENT
            logData.title = config.constants.LOG_MSG_TITLE.APPOINTMENT_BOOKED;
            logData.message = config.constants.LOG_MESSAGE.APPOINTMENT_BOOKED;
            logData.message = logData.message.replace('{{admin}}', res.locals.user.first_name +' '+ res.locals.user.last_name);
            logData.message = logData.message.replace('{{appointment_id}}', appointment.huno_id);
            logData.message = logData.message.replace('{{doctor_name}}', doctor.first_name + " " + doctor.last_name);
            logData.message = logData.message.replace('{{patient_name}}' , patient.user_id.first_name + " " + patient.user_id.last_name);
            logData.record_id =  appointment._id;
            await createAdminLog(logData);
            if (appointment.status == "scheduled")
                return jsonResponse(
                    res,
                    appointment,
                    translator.__("create_success"),
                    200
                )
            await Transaction.deleteOne({ appointment: appointment._id, status: "initiated" })
            return createPaymentLink({
                amount: appointment.fee * 100,
                currency: appointment.currency,
                customer: {
                    name: patient.user_id.first_name + " " + patient.user_id.last_name,
                    email: patient.user_id.email,
                    contact: patient.user_id.mobile_number
                },
                notes: { appointment: appointment._id.toString() }
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
            return errorResponse(e, res, e.code);
        });
};

const deletePatient = async (req, res) => {
    const validations = { mobile_number: "required" };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let { mobile_number } = req.body
            let message = "Cannot find user to delete."
            let user = await User.findOne({ mobile_number: mobile_number })
            if (user) {
                let patientId = await Patient.findOne({ user_id: user._id }, { _id: 1 })
                let matchCond = {}
                if (patientId) {
                    matchCond = { ...matchCond, patient: patientId }
                    await Report.deleteMany({ patient: patientId })
                    await Patient.deleteOne({ _id: patientId })
                }
                if (Object.keys(matchCond).length > 0) {
                    let ids = []
                    let prescriptions = []
                    await Appointment.find(matchCond, { _id: 1, prescription: 1 }).then(results => {
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
                        await Transaction.deleteMany({ appointment: { $in: ids } })
                        await Appointment.deleteMany({ _id: { $in: ids } })
                    }
                    if (prescriptions && prescriptions.length > 0) {
                        await Prescription.deleteMany({ _id: { $in: prescriptions } })
                    }
                }
                await Notification.deleteMany({ user_id: user._id })
                let convIds = []
                let rooms = []
                await Conversation.find({ participants: user._id }).then(convs => {
                    if (convs && convs.length > 0) {
                        convs.forEach(conv => {
                            convIds.push(conv._id)
                            rooms.push(conv.room_id)
                        })
                    }
                })
                if (rooms.length > 0) {
                    await Message.deleteMany({ room_id: { $in: rooms } })
                }
                if (convIds.length > 0) {
                    await Conversation.deleteMany({ _id: { $in: convIds } })
                }
                await User.deleteOne({ mobile_number: mobile_number })
                message = "Patient has deleted successfully!"
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

const deleteDoctor = async (req, res) => {
    const validations = { mobile_number: "required" };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let { mobile_number } = req.body
            let message = "Cannot find user to delete."
            let user = await User.findOne({ mobile_number: mobile_number })
            if (user) {
                let docId = await Doctor.findOne({ user_id: user._id }, { _id: 1 })
                let matchCond = {}
                if (docId) {
                    matchCond = { ...matchCond, doctor: docId }
                    await Doctor.deleteOne({ _id: docId })
                }
                if (Object.keys(matchCond).length > 0) {
                    let ids = []
                    let prescriptions = []
                    await Appointment.find(matchCond, { _id: 1, prescription: 1 }).then(results => {
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
                        await Transaction.deleteMany({ appointment: { $in: ids } })
                        await Appointment.deleteMany({ _id: { $in: ids } })
                    }
                    if (prescriptions && prescriptions.length > 0) {
                        await Prescription.deleteMany({ _id: { $in: prescriptions } })
                    }
                }
                await Notification.deleteMany({ user_id: user._id })
                let convIds = []
                let rooms = []
                await Conversation.find({ participants: user._id }).then(convs => {
                    if (convs && convs.length > 0) {
                        convs.forEach(conv => {
                            convIds.push(conv._id)
                            rooms.push(conv.room_id)
                        })
                    }
                })
                if (rooms.length > 0) {
                    await Message.deleteMany({ room_id: { $in: rooms } })
                }
                if (convIds.length > 0) {
                    await Conversation.deleteMany({ _id: { $in: convIds } })
                }
                await User.deleteOne({ mobile_number: mobile_number })
                message = "Doctor has deleted successfully!"
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

const deleteAdminUser = async (req, res) => {
    const validations = { user_id: "required" };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let { user_id } = req.body
            let message = "Cannot find admin user to delete."
            let user = await User.findOne({ _id: user_id })
            if (user) {
                await User.deleteOne({ _id: user_id })
                message = "Admin User has deleted successfully!"
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

const updateAdminProfile = async (req, res) => {
    const validations = { user_id: "required" };
    const translator = translate(req.headers.lang);
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let { user_id } = req.body
            let matchCond = {_id: user_id, profile_types:{$elemMatch:{$eq:"3"}}}
            let user = await User.findOne(matchCond)
            let existing = user && user.profile_types.includes(config.constants.USER_TYPE_ADMIN);
            if (!existing) {
                throw new HandleError("User Admin not exists in the system", 400)
            }
            if (typeof req.body.password !== 'undefined' && req.body.password !== "") {
                req.body.password = cryptPassword(req.body.password);
            }
            user=  await updateAdmin(user_id, req.body, res.locals.user);
            return jsonResponse(
                res,
                user,
                translator.__("update_success"),
                200
            );
        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });
}

const sendNotificationToUsers = async (req, res) => {
    const validations = { user_type: "required", msg: "required"};
    const translator = translate(req.headers.lang);
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {user_type, msg, user_ids=[], msg_title='DiaMed' } = req.body;
            user_type = parseInt(user_type);
            let sendData, storeData, usersData, doctors, patients;
            sendData = {};
            sendData.notification_title = msg_title;
            sendData.notification_body = msg;
            sendData.notification_data = {type: config.constants.NOTIFICATION_TYPE.FROM_ADMIN}
            sendData.device_tokens = [];

            storeData = {};
            storeData.title = msg_title
            storeData.message = msg;
            storeData.message_type = config.constants.NOTIFICATION_TYPE.FROM_ADMIN;

            var notifications = [];
            switch(user_type) {
                case 1:
                    // Getting patients to send notification msg.
                    patients = await Patient.find({});
                    for await (let patient of patients) {                        

                        if(patient.user_id.device_token){
                            sendData.device_tokens.push(patient.user_id.device_token);
                            notifications.push({...storeData, user_id: patient.user_id._id})
                            if(notifications.length%800==0){
                                await sendPushNotificationToMultiple(sendData);
                                // Using to store notification message in the notification table. 
                                await createMultipleNotification(notifications); 
                                sendData.device_tokens = [];
                                notifications = [];
                            }
                        }
                    }
                    // Getting doctors to send notification msg.
                    doctors = await Doctor.find({});
                    for await (let doctor of doctors) {
                        usersData = await User.find({_id: doctor.user_id}, { _id: 1, device_type:1, device_token:1 });
                        usersData = usersData.pop();
                        
                        if(usersData.device_token){
                            sendData.device_tokens.push(usersData.device_token);
                            notifications.push({...storeData, user_id: usersData._id})
                            if(notifications.length%800==0){
                                await sendPushNotificationToMultiple(sendData);
                                // Using to store notification message in the notification table. 
                                await createMultipleNotification(notifications); 
                                sendData.device_tokens = [];
                                notifications = [];
                            }
                        }
                    }
                break;
                case 2:
                    // Getting patients to send notification msg.
                    patients = await Patient.find({});                   
                    for await (let patient of patients) {
                        if(patient.user_id.device_token){
                            sendData.device_tokens.push(patient.user_id.device_token);
                            notifications.push({...storeData, user_id: patient.user_id._id})
                            if(notifications.length%800==0){
                                await sendPushNotificationToMultiple(sendData);
                                // Using to store notification message in the notification table. 
                                await createMultipleNotification(notifications); 
                                sendData.device_tokens = [];
                                notifications = [];
                            }
                        }
                    }
                  break;
                case 3:
                    // Getting doctors to send notification msg.
                    doctors = await Doctor.find({});
                    for await (let doctor of doctors) {
                        usersData = await User.find({_id: doctor.user_id}, { _id: 1, device_type:1, device_token:1 });
                        usersData = usersData.pop();

                        if(usersData.device_token){
                            sendData.device_tokens.push(usersData.device_token);
                            notifications.push({...storeData, user_id: usersData._id})
                            if(notifications.length%800==0){
                                await sendPushNotificationToMultiple(sendData);
                                // Using to store notification message in the notification table. 
                                await createMultipleNotification(notifications); 
                                sendData.device_tokens = [];
                                notifications = [];
                            }
                        }

                    }
                break;
                default:
                    usersData = await User.find({_id: {$in: user_ids}}, { _id: 1, device_type:1, device_token:1 });
                    for await (const userData of usersData) {
                        sendData.device_tokens.push(userData.device_token);
                        notifications.push({...storeData, user_id: userData._id})
                        if(notifications.length%800==0){
                            await sendPushNotificationToMultiple(sendData);
                            // Using to store notification message in the notification table. 
                            await createMultipleNotification(notifications); 
                            sendData.device_tokens = [];
                            notifications = [];
                        }
                       
                    }                    

            }
            if(notifications.length>0){                
                await sendPushNotificationToMultiple(sendData);
                await createMultipleNotification(notifications); 
            }
            return jsonResponse(
                res,
                {},
                translator.__("create_success"),
                200
            );
        })
        .catch((e) => {
            return errorResponse(e, res, e.code);
        });
}


module.exports = {
    index,
    cleanupUserRecords,
    bookAppointment,
    deletePatient,
    deleteDoctor,
    deleteAdminUser,
    updateAdminProfile,
    sendNotificationToUsers,
}
