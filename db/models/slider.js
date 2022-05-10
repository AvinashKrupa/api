import mongoose from 'mongoose';
import {addBy, addSoftDelete, getCommonOptions} from "../../helpers/modelHelper";
import * as config from "../../config/config";

const schema = new mongoose.Schema({
    speciality_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Speciality",
        autopopulate: {maxDepth: 1, select: ''}
    },
    title: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
        enum: ["promo"],
        default: "promo"
    },
    user_type: {
        type: String,
        default: config.constants.USER_TYPE_PATIENT
    },
    desc: {
        type: String,
    },
    mob_image:{
        type: String,
    },
    enabled: {
        type: Boolean
    }
}, {...getCommonOptions()});

addBy(schema)
addSoftDelete(schema)

const Slider = mongoose.model('Slider', schema);

export default Slider;
