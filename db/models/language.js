import mongoose from 'mongoose';
import {addBy, addSoftDelete, getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    enabled: {
        type: Boolean,
        default: true
    },
}, {...getCommonOptions()});

addBy(schema)

addSoftDelete(schema)

const Language = mongoose.model('Language', schema);

export default Language;
