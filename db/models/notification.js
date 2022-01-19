import mongoose from 'mongoose';
import User from './user';
import {getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    appointment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
    },
    message_type: {
        type: Number,
    },
    title: {
        type: String,
    },
    message: {
        type: String,
    },
    is_read: {
        type: Boolean,
        default: false
    }
}, {...getCommonOptions()});

export default mongoose.model('Notification', schema);
