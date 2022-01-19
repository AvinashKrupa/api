import mongoose from 'mongoose';
import {addBy, getCommonOptions} from "../../helpers/modelHelper";
import {cryptPassword} from "../../helpers/hashHelper";
import * as config from "../../config/config";

const schema = new mongoose.Schema({

    first_name: {
        type: String,
        required: true,
        trim: true
    },
    last_name: {
        type: String,
        trim: true
    },
    mobile_number: {
        type: String,
        required: true,
        trim: true,
    },
    country_code: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        trim: true,
    },
    gender: {
        type: String,
        enum: ["Male", "Female", "Other", ""]
    },
    dob: {
        type: String,
    },
    dp: {
        type: String,
        trim: true,
    },
    role_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
    },
    profile_types: {
        type: Array
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'inactive'],
        default: 'pending',
        required: true
    },
    language: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Language",
        autopopulate: {maxDepth: 1, select: 'name'}
    }],
    password: {
        type: String,
    },
    device_type: {
        type: String,
        enum: [config.constants.DEVICE_TYPE.IOS, config.constants.DEVICE_TYPE.ANDROID, config.constants.DEVICE_TYPE.WEB],
        default: config.constants.DEVICE_TYPE.WEB,
    },
    device_token: {
        type: String,
        default: ''
    }

}, {...getCommonOptions()});

addBy(schema)

schema.virtual('setPassword').set(function (password) {
    this.password = cryptPassword(password)
});
schema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret, options) {
        delete ret.password;
        return ret
    }
})
schema.pre('save', function (next) {
    const self = this
    if (self.isNew && !self.dp) {
        let basePath = "https://" + process.env.S3_BUCKET_NAME.substr(0, process.env.S3_BUCKET_NAME.length - 1) + ".s3.ap-south-1.amazonaws.com/images/default/"
        if (self.gender === "Female") {
            if (self.profile_types.includes(config.constants.USER_TYPE_DOCTOR))
                self.dp = basePath + "female-doctor.png"
            else {
                self.dp = basePath + "female-patient.png"
            }
        } else {
            self.dp = basePath + "avatar.png"
        }
    }
    return next();
});
const User = mongoose.model('User', schema);

export default User;
