require('dotenv').config()
import FCM from "fcm-node";

const fcm_server_key = process.env.FCM_SERVER_KEY; //put your server key here
const fcm_instance = new FCM(fcm_server_key);

// Using to send push notification to a single device.
export const sendPushNotification = (payload) => {
    if (!payload.device_token) {
        console.error("No device token found to send notification")
        return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
        //if(payload.device_type==config.constants.DEVICE_TYPE.IOS || payload.device_type==config.constants.DEVICE_TYPE.ANDROID) {
        let message = {
            to: payload.device_token,
            //collapse_key: 'your_collapse_key',
            notification: {
                title: payload.notification_title,
                body: payload.notification_body
            },
            data: payload.notification_data
        };
        // return resolve("FCM not added")
        fcm_instance.send(message, (err, response) =>{
            if (err) {
                console.error("Something has gone wrong!", JSON.stringify(err));
                //reject(err);
                resolve()
                // return Promise.resolve()
            } else {
                resolve(response);
            }
        });
        //}
    })
}

// Using to send push notification to a multiple devices.
export const sendPushNotificationToMultiple = (payload) => {
    if (payload.device_tokens.length==0) {
        console.error("No device token found to send notification")
        return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
        //if(payload.device_type==config.constants.DEVICE_TYPE.IOS || payload.device_type==config.constants.DEVICE_TYPE.ANDROID) {
        let message = {
            tokens: payload.device_tokens,
            //collapse_key: 'your_collapse_key',
            notification: {
                title: payload.notification_title,
                body: payload.notification_body
            },
            data: payload.notification_data
        };
        // return resolve("FCM not added")
        fcm_instance.send(message, (err, response) =>{
            if (err) {
                console.error("Something has gone wrong!", JSON.stringify(err));
                //reject(err);
                resolve()
                // return Promise.resolve()
            } else {
                resolve(response);
            }
        });
        //}
    })
}
