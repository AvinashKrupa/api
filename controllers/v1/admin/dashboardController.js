import {translate} from "../../../helpers/multilingual";
import {jsonResponse} from "../../../helpers/responseHelper";
import Doctor from "../../../db/models/doctor";
import Patient from "../../../db/models/patient";
import Appointment from "../../../db/models/appointment";


const headerData = async (req, res) => {
    const translator = translate(req.headers.lang);
    let headers = {
        doctors: 0,
        patients: 0,
        appointments: 0,
        revenue: 0
    }
    Promise.all([
        Doctor.countDocuments(),
        Patient.countDocuments(),
        Appointment.countDocuments(),
        Appointment.aggregate([{
            $match: {
                status: "completed"
            }
        }, {
            $group: {
                _id: null,
                total: {
                    $sum: "$fee"
                }
            }
        }])
    ]).then(results => {
        if (results) {
            headers.doctors = results[0]
            headers.patients = results[1]
            headers.appointments = results[2]
            if (results[3][0])
                headers.revenue = results[3][0].total
        }

        return jsonResponse(
            res,
            headers,
            translator.__("retrieve_success"),
            200
        );
    }).catch(e => {
        return jsonResponse(
            res,
            headers,
            translator.__("retrieve_success"),
            200
        );
    })


}


module.exports = {
    headerData,
}
