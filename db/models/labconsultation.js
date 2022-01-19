import mongoose from 'mongoose';
import {getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    investigations: [{
        type: String,
    }],
}, {...getCommonOptions()});

export default mongoose.model('Labconsultation', schema);
