import mongoose from 'mongoose';
import {addBy, addSoftDelete, getCommonOptions} from "../../helpers/modelHelper";
import moment from "moment-timezone";

const schema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
    },
    desc: {
        type: String,
        required: true,
    },
    discount_pct: {
        type: Number,
        required: true,
    },
    start_date: {
        type: Date,
        required: true
    },
    end_date: {
        type: Date,
        required: true
    },
    max_usages: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ["active", 'inactive', 'expired', 'used'],
        default: 'inactive',
        required: true
    },
    usages: [{
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
        },
        appointment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Appointment",
        },
        date: {
            type: Date,
        }
    }]
}, {...getCommonOptions()});

addBy(schema)
addSoftDelete(schema)

schema.pre('save', function (next) {
    const self = this
    if (self.end_date && moment().isAfter(moment(self.end_date))) {
        self.status = "expired"
    }
    if (self.isNew && self.start_date && moment().isBetween(moment(self.start_date), moment(self.end_date))) {
        self.status = "active"

    }
    return next();
});

const Coupon = mongoose.model('Coupon', schema);

export default Coupon;
