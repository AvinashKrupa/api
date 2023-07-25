import mongoose from 'mongoose';
import {addBy, addSoftDelete, getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    title: {
        type: String,
    },
    value: {
        type: String,
    },


}, {...getCommonOptions()});

addBy(schema)
addSoftDelete(schema)

const Configuration = mongoose.model('Configuration', schema);

export default Configuration;
