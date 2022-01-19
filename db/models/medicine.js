import mongoose from 'mongoose';
import {getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum : ['brand','composition'],
        default: 'brand',
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, {...getCommonOptions()});

export default mongoose.model('Medicine', schema);
