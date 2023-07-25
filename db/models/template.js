import mongoose from 'mongoose';
import {getCommonOptions} from "../../helpers/modelHelper";
import {PrescriptionSchema} from "./prescription";

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        required: true
    },
    prescription_info: [PrescriptionSchema]
}, {...getCommonOptions(true)});

schema.index({name: 1});

export default mongoose.model('Template', schema);
