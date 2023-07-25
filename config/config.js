require('dotenv').config()
module.exports = {
    appPort: process.env.PORT,
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRATION,
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRATION,
    transporterSmtp: {
        host: process.env.SMTP_HOST || 'email-smtp.ap-south-1.amazonaws.com',
        port: process.env.SMTP_PORT || 465,
        secure: process.env.SMTP_IS_SECURE || true,
        account: {
            user: process.env.SMTP_USER || 'AKIAUWEW62VE42GTV6GF',
            pass: process.env.SMTP_PASSWORD || 'BCfT5LHVMWL9dOeXrIl7nRHJTWPlwLdvl7NJ+CJ2GWDu'
        }
    },
    constants: {
        USER_TYPE_PATIENT: "1",
        USER_TYPE_DOCTOR: "2",
        USER_TYPE_ADMIN: "3",
        USER_TYPE_LAB: "4",
        USER_TYPE_HOSPITAL: "5",
        DEVICE_TYPE: {
            IOS: 'ios',
            ANDROID: 'android',
            WEB: 'web'
        },
        NOTIFICATION_TYPE: {
            APPOINTMENT_BOOKING: 1,
            APPOINTMENT_SCHEDULED: 2,
            APPOINTMENT_CANCELLATION: 3,
            APPOINTMENT_REFUND_PROCESSED: 4,
            APPOINTMENT_NEW_PRESCRIPTION: 5,
            APPOINTMENT_NEW_REPORT: 6,
            DOCTOR_PROFILE_APPROVAL: 7,
            PARTICIPANT_DID_NOT_JOIN: 8,
            APPOINTMENT_BOOKING_FAILED: 9,
            FROM_ADMIN : 12,
        },
        NOTIFICATION_MESSAGE: {
            APPOINTMENT_BOOKING_PATIENT: 'Your Appointment has been scheduled with Doctor {{doctor}} at {{date_time}}',
            APPOINTMENT_BOOKING_DOCTOR: 'Your Appointment has been scheduled with Patient {{patient}} at {{date_time}}',
            APPOINTMENT_SCHEDULED: 'Your appointment will start shortly, please join the appointment meeting to begin your consultation',
            APPOINTMENT_CANCELLATION: `Your ${process.env.APP_NAME} Appointment ID: {{appointment_id}} has been Cancelled`,
            APPOINTMENT_REFUND_PROCESSED: 'The refund for your appointment {{appointment_id}} has been successfully processed',
            APPOINTMENT_NEW_PRESCRIPTION: 'The prescription for your appointment dated {{date_time}} is now ready for viewing',
            APPOINTMENT_NEW_REPORT: 'The new report for your appointment {{appointment_id}} is now available for viewing',
            DOCTOR_PROFILE_APPROVAL: `Congratulations your account has been approved , Welcome Onboard to the ${process.env.APP_NAME} Family`,
            APPOINTMENT_BOOKING_FAILED: `We could not book your appointment {{appointment_id}}. If you have made a payment, refund will processed within 7 working days.`,
        },
        NOTIFICATION_TITLE: {
            APPOINTMENT_BOOKING_PATIENT: 'Appointment Booked',
            APPOINTMENT_BOOKING_DOCTOR: 'Appointment Booked',
            APPOINTMENT_SCHEDULED: 'Appointment Scheduled',
            APPOINTMENT_CANCELLATION: 'Appointment Cancelled',
            APPOINTMENT_REFUND_PROCESSED: 'Appointment Refund Processed',
            APPOINTMENT_NEW_PRESCRIPTION: 'Prescription Added',
            APPOINTMENT_NEW_REPORT: 'Report Added',
            DOCTOR_PROFILE_APPROVAL: 'Profile Approved',
            APPOINTMENT_BOOKING_FAILED: `Appointment booking failed`,
        },
        EMAIL_SUBJECT: {
            APPOINTMENT_UPDATED: '{{appointment_id}} : Appointment Updated',
            DOCTOR_PROFILE_APPROVAL: `Congratulations your account has been approved, Welcome Onboard to the ${process.env.APP_NAME} Family`,
            DOCTOR_PROFILE_REJECTED: 'Your account has been rejected, Please contact support'
        },
        LOG_MSG_MODULE_NAME :{
            APPOINTMENT: 'Appointment',
            COUPON: 'Coupon',
            DOCTOR_PROFILE: 'Doctor',
            PATIENT_PROFILE: 'Patient',
        },
        LOG_MSG_TITLE: {
            APPOINTMENT_BOOKED: 'Appointment Booked',
            APPOINTMENT_RESCHEDULED: 'Appointment Rescheduled',
            APPOINTMENT_CANCELED: 'Appointment Canceled ',
            COUPON_CREATED: 'Coupon Created',
            COUPON_STATUS_CHANGED: 'Coupon Status Changed',

            DOCTOR_PROFILE_CREATED: 'Doctor Profile Created',
            DOCTOR_PROFILE_APPROVAL: 'Doctor Profile Approved',
            DOCTOR_FEE_UPDATED: 'Doctor Fee Updated',
            DOCTOR_SPECIALTY_UPDATED: 'Doctor Specialty Changed',
            DOCTOR_PROFILE_UPDATED: 'Doctor Profile Updated',

            PATIENT_PROFILE_CREATED: 'Patient Profile Created',
            PATIENT_PROFILE_APPROVAL: 'Patient Profile Approved',
        },
        LOG_MESSAGE: {
            APPOINTMENT_BOOKED: 'The user {{admin}} has booked an appointment ID:{{appointment_id}} with {{doctor_name}} for the patient {{patient_name}}.',
            APPOINTMENT_RESCHEDULED: 'The User {{admin}} has rescheduled the appointment ID:{{appointment_id}}',
            APPOINTMENT_CANCELED: 'The User {{admin}} has canceled the appointment ID:{{appointment_id}}',
            COUPON_CREATED: 'The User {{admin}} has created a coupon code {{coupon_code_name}} for {{for_use}} usage.',
            COUPON_STATUS_CHANGED: 'The User {{admin}} {{status}} the coupon code.',

            DOCTOR_PROFILE_CREATED: 'The user {{admin}} has created a profile for {{doctor_name}}',
            DOCTOR_PROFILE_APPROVAL: '{{admin}} has approved a doctor {{doctor_name}} profile.',
            DOCTOR_FEE_UPDATED: 'The User {{admin}} has changed the consultation fees from {{old_fee}} to {{new_fee}} for the doctor {{doctor_name}}.',
            DOCTOR_SPECIALTY_UPDATED: 'The User {{admin}} has updated the specialty for the doctor {{doctor_name}}',
            DOCTOR_PROFILE_UPDATED: 'The user {{admin}} has updated a profile for {{doctor_name}}',

            PATIENT_PROFILE_CREATED: 'The user {{admin}} has created a patient profile for {{patient_name}}.',
            PATIENT_PROFILE_APPROVAL: '{{admin}} has approved a profile {{patient_name}} profile.',
        },
    }
};
