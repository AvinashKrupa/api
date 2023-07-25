const nodeMailer = require('nodemailer');
import * as config from "../config/config";

const transporter = nodeMailer.createTransport({
    host: config.transporterSmtp.host,
    port: config.transporterSmtp.port,
    secure: config.transporterSmtp.secure, // true for 465, false for other ports
    auth: {
        user: config.transporterSmtp.account.user, // generated user
        pass: config.transporterSmtp.account.pass  // generated password
    },
    tls: {
        ciphers: 'SSLv3'
    }
});

export const sendEmail = (emailId, emailSubject, html,cc) => {
    return new Promise((resolve, reject) => {
        let mailOptions = {
            from: 'DiaMed <' + 'noreply@diamed.app>',
            to: emailId,
            subject: emailSubject,
            html: html
        };
        if(cc){
            mailOptions.cc=cc
        }
        /* switch (emailType) {
        } */
        //console.log('mailOptions', mailOptions);
        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                //console.error("Something went wrong during sending email", JSON.stringify(err));
                //reject({message: "Something went wrong. ", code: 400, error: err})
            }
            //console.log('Message sent: %s', info.messageId);
            resolve(info);
        });
    });
}


