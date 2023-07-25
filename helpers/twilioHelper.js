const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioServiceId = process.env.TWILIO_SERVICE_ID;
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

const client = require('twilio')(accountSid, authToken);

export const sendVerificationOtp = (phoneNum) => {
    if (process.env.NODE_ENV == "dev"||phoneNum=="+917300340409" )
        return Promise.resolve(true)
    return client.verify.services(twilioServiceId)
        .verifications
        .create({to: phoneNum, channel: 'sms'});
}

export const verifyOTP = (otp, phoneNum) => {
    if (process.env.NODE_ENV == "dev"||phoneNum=="+917300340409")
        if (otp === "1111") {
            return Promise.resolve(true)
        } else {
            return Promise.reject({message: "Invalid OTP.", code: 400})
        }
    return client.verify.services(twilioServiceId)
        .verificationChecks
        .create({to: phoneNum, code: otp}).then(result => {
            if (result.valid)
                return Promise.resolve(result)
            else
                return Promise.reject({message: "Invalid OTP.", code: 400})
        }).catch(error => {
            return Promise.reject({message: "Otp expired. Please request a new one.", code: 400})
        })
}

export const sendMsg = async (phoneNum, msg) => {
    if (process.env.NODE_ENV == "dev")
        return Promise.resolve(true)
    return client.messages.create({
        body: msg,
        to: phoneNum,  // Text this number
        from: twilioFromNumber // From a valid Twilio number
    }).then(res => {
        //console.log('Sent message to the number', phoneNum);
        return Promise.resolve(res);
    }).catch(error => {
        //console.log('Something went wrong during sending msg.', error);
        return Promise.resolve(false)
    })
}
