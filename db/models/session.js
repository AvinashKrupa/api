import mongoose from 'mongoose';
import {getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    refresh_token: {
        type: String,
    },
    access_token: {
        type: String,
    },

}, {...getCommonOptions()});
const Session = mongoose.model('Session', schema);

export default Session;
