import {translate} from "../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import Appointment from "../../db/models/appointment";
import Prescription from "../../db/models/prescription";
import Labconsultation from "../../db/models/labconsultation";
import Template from "../../db/models/template";

import {validate} from "../../helpers/validator";
import {HandleError} from "../../helpers/errorHandling";
import {initiateNotifications} from "../../helpers/notificationHelper";
import * as config from "../../config/config";
import {createPdfOfHtmlDoc, renderPdfData} from "../../helpers/pdfGenHelper";
import {uploadFile} from "../../helpers/s3FileUploadHelper";
import {getTimezonedDateFromUTC} from "../../helpers/timeHelper";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    return jsonResponse(
        res,
        result,
        translator.__("create_success"),
        200
    );
}

const saveAsTemplate = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        name: "required",
        prescription_info: "required"
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let document = req.body;
            document.doctor = res.locals.user.selected_profile_id;
            return Template.create(document).then(result => {
                return jsonResponse(
                    res,
                    result,
                    translator.__("create_success"),
                    200
                );
            })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

const submitPrescription = (req, res) => {
    let {timezone = "Asia/Calcutta"} = req.headers
    const validations = {
        appointment_id: "required",
        prescriptions: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {appointment_id, investigations} = req.body;
            let prescriptions = req.body.prescriptions.map(pres => {
                if (!pres.medicine || pres.medicine == "")
                    delete pres.medicine
                return pres
            })
            let prescriptionResult = await Prescription.insertMany(prescriptions);
            prescriptionResult = prescriptionResult.map(prescription => {
                return prescription._id;
            })

            // Generate pdf of the prescription of the appointment
            let prescriptionsData = prescriptions;
            await renderPdfData(prescriptionsData);

            let appointment_data = await Appointment.findOne({_id: appointment_id})
                .populate('patient', "user_id")
                .populate('doctor', "first_name last_name");
            let today = new Date();
            let dob = new Date(appointment_data.patient.user_id.dob);
            let age = today.getFullYear() - dob.getFullYear();

            let appointment_date = await getTimezonedDateFromUTC(appointment_data.time.utc_time, timezone, 'DD-MM-YYYY');
            let patient_data = {};
            patient_data.age = age;
            patient_data.full_name = appointment_data.patient.user_id.first_name + ' ' + appointment_data.patient.user_id.last_name;
            patient_data.mobile_number = appointment_data.patient.user_id.country_code + appointment_data.patient.user_id.mobile_number;
            patient_data.email = appointment_data.patient.user_id.email;
            patient_data.gender = appointment_data.patient.user_id.gender;

            let doctor_data = {};
            doctor_data.full_name = appointment_data.doctor.first_name + ' ' + appointment_data.doctor.last_name;

            let data_for_pdf = {};
            data_for_pdf.prescriptions = prescriptionsData;
            data_for_pdf.appointment_id = appointment_id;
            data_for_pdf.patient_data = patient_data;
            data_for_pdf.doctor_data = doctor_data;
            data_for_pdf.appointment_date = appointment_date;
            data_for_pdf.investigations = investigations;

            let presc_pdf_buffer = await createPdfOfHtmlDoc(data_for_pdf);
            //Uploading generated pdf on the s3 bucket
            let s3_res = await uploadFile({
                buffer: presc_pdf_buffer,
                originalname: 'prescription.pdf'
            }, 'prescriptions_pdf');

            let updateObj = {prescription: prescriptionResult, presc_url: s3_res.Location}
            if (investigations && investigations.length > 0) {
                let labconsultationResult = await Labconsultation.create({investigations: investigations});
                updateObj = {...updateObj, labconsultation: labconsultationResult._id}
            }
            return Appointment.findOneAndUpdate({_id: appointment_id}, {
                $set: updateObj
            }, {returnNewDocument: true}).then(async (result) => {
                if (result) {
                    // Sending message notification to the patient user
                    await initiateNotifications(result, config.constants.NOTIFICATION_TYPE.APPOINTMENT_NEW_PRESCRIPTION)
                    return jsonResponse(
                        res,
                        result,
                        "Appointment's prescription added.",
                        200
                    );
                } else {
                    throw new HandleError("Prescription cannot be added to the appointment.", 400)
                }
            })
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

const getSavedTemplate = (req, res) => {
    const translator = translate(req.headers.lang);
    return Template.find({doctor: res.locals.user.selected_profile_id})
        .populate("prescription_info.medicine", "name type").populate("prescription_info.medicinetype", "name").then(templates => {
            return jsonResponse(
                res,
                templates,
                translator.__("retrieve_success"),
                200
            );
        }).catch((e) => {
            return errorResponse(e, res, e.code);
        });
}

const deleteSavedTemplate = (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        ids: "required",
    };
    validate(req.body, validations)
        .then(async (matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            await Template.deleteMany({_id: {$in: req.body.ids}});
            return jsonResponse(
                res,
                null,
                translator.__("successful_deleted"),
                200
            );
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });
}

module.exports = {
    index,
    saveAsTemplate,
    submitPrescription,
    getSavedTemplate,
    deleteSavedTemplate
}
