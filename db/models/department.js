import mongoose from 'mongoose';
import {addBy, addSoftDelete, getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    enabled: {
        type: Boolean
    }
}, {...getCommonOptions()});

addBy(schema)

addSoftDelete(schema)
const Department = mongoose.model('Department', schema);

export default Department;
