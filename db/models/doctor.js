import mongoose from 'mongoose';
import {addBy, addressType, getCommonOptions} from "../../helpers/modelHelper";
import Department from "./department";
import Speciality from "./speciality";
import User from "./user";
import {getNextSequence} from "./counter";

const qualifSchema = new mongoose.Schema({
    _id: false,
    dept_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
    },
    specl: [{
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Speciality",
        },
        title: {
            type: String
        }
    }],
    med_reg_num: {
        type: String,
    },
    quals: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Qualification",

    }],
    highest_qual: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Qualification",
    },
    reg_date: {
        type: Date,
    },
    renewal_date: {
        type: Date,
    },
    fee: {
        type: Number,
    },
    exp: {
        type: Number,
    },
    currency: {
        type: String,
        default: "INR"
    },
})

const availSchema = new mongoose.Schema({
    _id: false,
    day: {
        sun: {type: Boolean},
        mon: {type: Boolean},
        tue: {type: Boolean},
        wed: {type: Boolean},
        thu: {type: Boolean},
        fri: {type: Boolean},
        sat: {type: Boolean},
    },
    slots: [{
        type: Number
    }],
    shift: {
        shift1: {
            start: {
                type: String
            },
            end: {
                type: String
            }
        },
        shift2: {
            start: {
                type: String
            },
            end: {
                type: String
            }
        }
    }
})

const schema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    huno_id: {
        type: String,
    },
    first_name: {
        type: String
    },
    last_name: {
        type: String
    },
    desc: {
        type: String,
    },
    qualif: qualifSchema,
    avail: availSchema,
    refer_code: {
        type: String,
        trim: true,
    },
    address: addressType(),
    status: {
        type: String,
        enum: ['pending', 'active', 'inactive', 'unavail', 'rejected'],
        default: 'pending',
        required: true
    },
    meet_token: {
        type: String
    },
    set_consultation: {
        type: Number,
    },
    relation: {
        type: String
    },
    relative_name : {
        type: String
    },
    digital_signature_url:{
        type: String
    },
    medical_cert_url:{
        type: String
    },
    notes:{
        type: String
    },
}, {...getCommonOptions()});

addBy(schema)

schema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret, options) {
        delete ret.meet_token;
        return ret
    }
})

schema.pre('save', function (next) {

    User.findOne({
        "_id": this.user_id
    }, {first_name: 1, last_name: 1 }).then(user => {
        if (user) {
            this.first_name = user.first_name
            this.last_name = user.last_name
        }
        next()
    }).catch(err => {
        next()
    })
});
schema.pre('save', function (next) {
    const self = this

    if (!self.isNew) {
        return next();
    } else {
        return getNextSequence("doctor").then(count => {
            self.huno_id = process.env.DOCTOR_SHORT_CODE + count;
            next();
        })
    }
});
schema.index({first_name: 1, last_name: 1, "qualif.specl.title": 1, "qualif.exp": 1, "qualif.fee": 1})

const Doctor = mongoose.model('Doctor', schema);

export default Doctor;
