import Medicine from "../db/models/medicine";
import Medicinetype from "../db/models/medicinetype";
const pdf = require("pdf-creator-node");
const fs = require("fs");

// Using to send push notification to a single device.
export const createPdfOfHtmlDoc = (payload) => {
    return new Promise((resolve, reject) => {
        let options = {};
        let html = fs.readFileSync(__dirname + "/../views/prescription.html", "utf8");
        const document = {
            html: html,
            data: {
                prescriptions: payload.prescriptions,
                appointment_id: payload.appointment_id,
                appointment_date: payload.appointment_date,
                patient_data: payload.patient_data,
                doctor_data: payload.doctor_data,
                investigations: payload.investigations
            },
            //path: __dirname + '/../../uploads/files/prescription.pdf',
            type: "buffer",
        };
        pdf.create(document, options).then((res) => {
            resolve(res);
        })
        .catch((err) => {
            console.error("Something has gone wrong!", err);
        });
    })
}

export const renderPdfData = (prescriptionsData) => {
    return new Promise(async (resolve, reject) => {
        let sq_number = 0;
        for await (let prescription of  prescriptionsData) {
            sq_number = sq_number + 1;
            prescription.sq_number = sq_number;
            if(prescription.medicine) {
                let medicineData = await Medicine.findOne({
                    _id: prescription.medicine,
                });
                prescription.medicine_name = medicineData.name;
            }

            let medicineTypeData = await Medicinetype.findOne({
                _id: prescription.medicinetype,
            });
            prescription.medicine_type_name = medicineTypeData.name;
           
            if(prescription.time_slots.includes("Morning")) {
                prescription.morning = '✔';
            } else {
                prescription.morning = 'X';
            }
            if(prescription.time_slots.includes("Afternoon")) {
                prescription.afternoon = '✔';
            } else {
                prescription.afternoon = 'X';
            }
            if(prescription.time_slots.includes("Night")) {
                prescription.night = '✔';
            } else {
                prescription.night = 'X';
            }

            if(prescription.dosage.before_food) {
                prescription.dosage.instruction = 'before food (Take '+prescription.dosage.qty+')';
            } 
            if(prescription.dosage.after_food) {
                prescription.dosage.instruction = 'after food (Take '+prescription.dosage.qty+')';
            } 
            if(prescription.dosage.with_food) {
                prescription.dosage.instruction = 'with food (Take '+prescription.dosage.qty+')';
            }
            if(prescription.dosage.other) {
                prescription.dosage.instruction = prescription.dosage.other_details+' (Take ' +prescription.dosage.qty+')';
            }

            if(prescription.dosage.sos) {
                prescription.sos = '✔';
            } else {
                prescription.sos = 'X';
            }

            if(prescription.dosage.stat) {
                prescription.stat = '✔';
            } else {
                prescription.stat = 'X';
            }


        }
        resolve(prescriptionsData);
    });
}
