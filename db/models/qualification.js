import mongoose from 'mongoose';
import {addBy, addSoftDelete, getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
    },
    includes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Qualification",
    }],
    enabled: {
        type: Boolean
    }
}, {...getCommonOptions()});

addBy(schema)
addSoftDelete(schema)

const Qualification = mongoose.model('Qualification', schema);

export default Qualification;
