import mongoose from 'mongoose';
import {getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    type: {
        type: String,
    },
    message: {
        type: String,
    },
    title: {
        type: String,
    }
}, {...getCommonOptions()});

export default mongoose.model('NotificationType', schema);
