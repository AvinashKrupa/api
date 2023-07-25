import mongoose from 'mongoose';
import {getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    medicine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Medicine",
        autopopulate: {maxDepth: 1, select: 'name'}
    },
    medicine_name:{
        type: String
    },
    medicinetype: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Medicinetype",
    },
    time_slots: [{
        type: String
    }],
    start_date: {
        type: String,
        required: true
    },
    days: {
        type: Number,
        required: true
    },
    periodicity: {
        type: String,
        required: true
    },
    add_comments: {
        type: String
    },
    appointment:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
    },
    dosage: {
        dosage_text: {
            type: String
        },
        qty: {
            type: String
        },
        before_food: {
            type: Boolean,
            default: false
        },
        after_food: {
            type: Boolean,
            default: false
        },
        with_food: {
            type: Boolean,
            default: false
        },
        other: {
            type: Boolean,
            default: false
        },
        other_details: {
            type: String,
        },
        sos: {
            type: Boolean,
            default: false
        },
        stat: {
            type: Boolean,
            default: false
        }
    },

}, {...getCommonOptions()});

const Prescription = mongoose.model('Prescription', schema);
export const PrescriptionSchema=schema
export default Prescription;
