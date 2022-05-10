//import * as config from "../config/config";
import Notification from "../db/models/notification";
import * as config from "../config/config";
import {sendPushNotification} from "./fcmHelper";
import {sendMsg} from "./twilioHelper";
import Appointment from "../db/models/appointment";
import {getTimezonedDateFromUTC} from "./timeHelper";
import Doctor from "../db/models/doctor";
import Patient from "../db/models/patient";
import {sendEmail} from "./emailNotifier";
import {capitalizeFirstLetter} from "./common";
import Configuration from "../db/models/configuration";

let ejs = require('ejs');

async function createNotification(data) {
    let notification = new Notification({
        user_id: data.user_id,
        message_type: data.message_type,
        message: data.message,
        title: data.title
    })
    return await notification.save();
}

async function createMultipleNotification(data) {

    return await Notification.insertMany(data);
}

async function initiateNotifications(appointment_data, notificationType) {
    let sendData, storeData, appointment_date, notify_msg, title_patient, title_doc, body_patient, body_doc,
        additional_msg_email;
    let timezone = "Asia/Calcutta";
    let notificationPromises = []
    if (!appointment_data._id) {
        appointment_data = await Appointment.findOne({_id: appointment_data}, {
            doctor: 1,
            patient: 1,
            time: 1,
            huno_id: 1
        })
    }
    let doctorUser = await Doctor.findOne({_id: appointment_data.doctor}, {user_id: 1})
        .populate("user_id", "_id first_name last_name device_token mobile_number country_code").then(result => {
            return Promise.resolve(result.user_id)
        })
    let patientUser = await Patient.findOne({_id: appointment_data.patient}, {user_id: 1}, {autopopulate: false})
        .populate("user_id", "_id first_name last_name device_token mobile_number country_code").then(result => {
            return Promise.resolve(result.user_id)
        })
    appointment_date = getTimezonedDateFromUTC(appointment_data.time.utc_time, timezone, 'DD-MM-YYYY HH:mm:ss');
    switch (notificationType) {
        case config.constants.NOTIFICATION_TYPE.APPOINTMENT_BOOKING:
            title_doc = config.constants.NOTIFICATION_TITLE.APPOINTMENT_BOOKING_DOCTOR
            body_doc = config.constants.NOTIFICATION_MESSAGE.APPOINTMENT_BOOKING_DOCTOR
            title_patient = config.constants.NOTIFICATION_TITLE.APPOINTMENT_BOOKING_PATIENT
            body_patient = config.constants.NOTIFICATION_MESSAGE.APPOINTMENT_BOOKING_PATIENT
            break;
        case config.constants.NOTIFICATION_TYPE.APPOINTMENT_CANCELLATION:
            title_doc = config.constants.NOTIFICATION_TITLE.APPOINTMENT_CANCELLATION
            body_doc = config.constants.NOTIFICATION_MESSAGE.APPOINTMENT_CANCELLATION
            title_patient = config.constants.NOTIFICATION_TITLE.APPOINTMENT_CANCELLATION
            body_patient = config.constants.NOTIFICATION_MESSAGE.APPOINTMENT_CANCELLATION
            break;
        case config.constants.NOTIFICATION_TYPE.APPOINTMENT_REFUND_PROCESSED:
            title_patient = config.constants.NOTIFICATION_TITLE.APPOINTMENT_REFUND_PROCESSED
            body_patient = config.constants.NOTIFICATION_MESSAGE.APPOINTMENT_REFUND_PROCESSED
            break;
        case config.constants.NOTIFICATION_TYPE.APPOINTMENT_BOOKING_FAILED:
            title_patient = config.constants.NOTIFICATION_TITLE.APPOINTMENT_BOOKING_FAILED
            body_patient = config.constants.NOTIFICATION_MESSAGE.APPOINTMENT_BOOKING_FAILED
            break;
        case config.constants.NOTIFICATION_TYPE.APPOINTMENT_NEW_PRESCRIPTION:
            title_patient = config.constants.NOTIFICATION_TITLE.APPOINTMENT_NEW_PRESCRIPTION
            body_patient = config.constants.NOTIFICATION_MESSAGE.APPOINTMENT_NEW_PRESCRIPTION
            additional_msg_email = "Prescription has been added for appointment."
            break;
    }
    if (body_patient) {
        // Sending push notification to the patient user
        notify_msg = body_patient.replace('{{doctor}}', doctorUser.first_name + ' ' + doctorUser.last_name);
        notify_msg = notify_msg.replace('{{date_time}}', appointment_date);
        notify_msg = notify_msg.replace('{{appointment_id}}', appointment_data.huno_id)
        sendData = {};
        sendData.device_token = patientUser.device_token;
        sendData.notification_title = title_patient;
        sendData.notification_body = notify_msg;
        sendData.notification_data = {type: notificationType}
        notificationPromises.push(sendPushNotification(sendData));
        // Using to store notification message in the notification table.
        storeData = {};
        storeData.user_id = patientUser._id;
        storeData.appointment_id = appointment_data._id;
        storeData.message_type = notificationType;
        storeData.title = sendData.notification_title;
        storeData.message = notify_msg;
        notificationPromises.push(createNotification(storeData));
        // Sending message notification to the patient user
        notificationPromises.push(sendMsg(patientUser.country_code + patientUser.mobile_number, notify_msg));
    }
    // Sending push notification to the doctor user
    if (body_doc) {
        notify_msg = body_doc.replace('{{patient}}', patientUser.first_name + ' ' + patientUser.last_name);
        notify_msg = notify_msg.replace('{{date_time}}', appointment_date);
        notify_msg = notify_msg.replace('{{appointment_id}}', appointment_data.huno_id)
        sendData = {};
        sendData.device_token = doctorUser.device_token;
        sendData.notification_title = title_doc;
        sendData.notification_body = notify_msg;
        sendData.notification_data = {type: notificationType}
        notificationPromises.push(sendPushNotification(sendData));
        // Using to store notification message in the notification table.
        storeData = {};
        storeData.user_id = doctorUser._id;
        storeData.appointment_id = appointment_data._id;
        storeData.message_type = notificationType;
        storeData.title = sendData.notification_title;
        storeData.message = notify_msg;
        notificationPromises.push(createNotification(storeData));
        // Sending message notification to the doctor user
        notificationPromises.push(sendMsg(doctorUser.country_code + doctorUser.mobile_number, notify_msg));
    }
    notificationPromises.push(new Promise(async (resolve, reject) => {
        try {
            let html = await ejs.renderFile(__dirname + '/../views/adminEmail.ejs', {
                message: {
                    huno_id: appointment_data.huno_id,
                    status: capitalizeFirstLetter(appointment_data.status),
                    time: appointment_date,
                    patient: patientUser.first_name + ' ' + patientUser.last_name,
                    doctor: doctorUser.first_name + ' ' + doctorUser.last_name,
                    additional: additional_msg_email
                }
            })
            let subject = config.constants.EMAIL_SUBJECT.APPOINTMENT_UPDATED.replace('{{appointment_id}}', appointment_data.huno_id)
            let adminEmail = await Configuration.findOne({name: "admin_email"})
            if (!adminEmail)
            adminEmail = "admin@livemed.io"
                // adminEmail = "paramveer@cnetric.com"
            else {
                adminEmail = adminEmail.value
            }
            resolve(sendEmail(adminEmail, subject, html));
        } catch (e) {
            resolve("Error loading template: " + JSON.stringify(e));
        }

    }))
    if (notificationPromises.length > 0)
        return Promise.all(notificationPromises)
    else
        return Promise.resolve()
}

module.exports = {
    createNotification,
    initiateNotifications,
    createMultipleNotification
}
