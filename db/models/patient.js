import mongoose from 'mongoose';
import {addBy, addressType, getCommonOptions} from "../../helpers/modelHelper";
import {getNextSequence} from "./counter";

const schema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        autopopulate: {maxDepth: 1, select: 'first_name last_name dp mobile_number country_code email gender dob device_token'}
    },
    huno_id:{
        type: String,
    },
    med_cond: [
        {
            name: {type: String},
            selected: {type: Boolean},
            diag_at: {type: Date},
            desc: {type: String},
            meta:[{
                name: {type: String},
                selected: {type: Boolean},
                diag_at: {type: Date},
                desc: {type: String},
            }]
        }
    ],
    height: {
        type: String,
    },
    dimen_type: {
        type: String,
        enum:["ft","cm"],
        default:"cm"
    },
    weight: {
        type: String,
    },
    other_med_cond: {
        type: String,
    },
    refer_code: {
        type: String,
        trim: true,
    },
    address: addressType(),
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'banned'],
        default: 'active',
        required: true
    },
    suspended_at: {
        type: Date
    },
    planned_cancellation: {
        type: Number
    },
    unplanned_cancellation: {
        type: Number
    },
    meet_token:{
        type:String
    },
    relation: {
        type: String
    },
    relative_name : {
        type: String
    },
    notes:{
        type: String
    }
}, {...getCommonOptions()});

addBy(schema)
schema.pre('save', function (next) {
    const self = this

    if (!self.isNew) {
        return next();
    } else {
        return getNextSequence("patient").then(count => {
            self.huno_id = process.env.PATIENT_SHORT_CODE + count;
            next();
        })
    }
});
schema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret, options) {
        delete ret.meet_token;
        return ret
    }
})
const Patient = mongoose.model('Patient', schema);

export default Patient;
