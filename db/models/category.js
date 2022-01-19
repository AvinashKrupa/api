import mongoose from 'mongoose';
import {addBy, addSoftDelete, getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    qualifications: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Qualification",
    }],
    enabled: {
        type: Boolean
    }
}, {...getCommonOptions()});

addBy(schema)
addSoftDelete(schema)

const Category = mongoose.model('Category', schema);

export default Category;
