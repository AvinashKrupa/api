import mongoose from 'mongoose';
import {addBy, getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({

    title: {
        type: String,
        required: true,
    },
    url: {
        type: String
    },
    date: {
        type: Date
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patient",
        required: true,
    },
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
    },
    type: {
        type: String,
        enum: ['MRI','CT Scan','Blood Test'],
        default: 'MRI',
        required: true
    },
}, {...getCommonOptions()});

addBy(schema)

const Report = mongoose.model('Report', schema);

export default Report;
