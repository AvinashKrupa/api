import mongoose from 'mongoose';
import {getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    slot: {type: Number},
    date: {
        type: Date
    },
    is_avail: {type: Boolean},
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        required: true,
    },
}, {...getCommonOptions()});

const Unavailability = mongoose.model('Unavailability', schema);

export default Unavailability;
