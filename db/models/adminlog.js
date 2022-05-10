import mongoose from 'mongoose';
import User from './user';
import {getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    module_name: {
        type: String,
    },
    title: {
        type: String,
    },
    message: {
        type: String,
    },
    record_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    profile_fields: {
        type: String,
    }
}, {...getCommonOptions()});

export default mongoose.model('Adminlog', schema);
