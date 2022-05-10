import mongoose from 'mongoose';
import {addBy, addSoftDelete, getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    thumb_url: {
        type: String,
        required: true,
    },
    url: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'inactive',
        required: true
    },
}, {...getCommonOptions()});

addBy(schema)
addSoftDelete(schema)

const Video = mongoose.model('Video', schema);

export default Video;
