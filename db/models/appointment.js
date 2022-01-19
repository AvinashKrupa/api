import mongoose from 'mongoose';
import {addBy, getCommonOptions} from "../../helpers/modelHelper";
import {getNextSequence} from "./counter";

const schema = new mongoose.Schema({
        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Doctor",
            required: true
        },
        additional_doc: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Doctor",
        }],
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true
        },
        huno_id: {
            type: String,
        },
        time: {
            utc_time: {
                type: Date
            },
            slot_id: {
                type: Number,
            },
            slot: {
                type: String
            }
        },
        status: {
            type: String,
            enum: ["pending", 'scheduled', 'cancelled', 'rejected', 'ongoing', 'completed', 'payment_failed', 'reserved'],
            default: 'pending',
            required: true
        },
        prescription: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Prescription",
        }],
        presc_url: {
            type: String
        },
        fee: {
            type: Number
        },
        refund_amount: {
            type: Number
        },
        currency: {type: String},
        currency_rate: {
            type: Number
        },
        consulting_type: {
            type: String,
            enum: ["audio", 'video'],
            default: 'video',
        },
        reason: {
            type: String
        },
        complaints: {
            type: String
        },
        cancel_reason: {
            type: String
        },
        labconsultation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Labconsultation",
        },
        participants: [],
        coupon: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Coupon",
        },
        code: {
            type: String
        },
        payment_mode: {
            type: String,
            enum: ['cash', 'online'],
            default: 'online',
        },
        adtnl_status: {
            type: String
        }

    }, {...getCommonOptions()}
);

addBy(schema)
schema.pre('save', function (next) {
    const self = this

    if (!self.isNew) {
        return next();
    } else {
        return getNextSequence("appointment").then(count => {
            self.huno_id = "HUNOA" + count;
            next();
        })
    }
});
const Appointment = mongoose.model('Appointment', schema);

export default Appointment;
