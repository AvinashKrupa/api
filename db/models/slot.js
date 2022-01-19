import mongoose from 'mongoose';
import {addBy, getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    slot_id: {
        type: Number,
        unique: true,
        index: true,
        required: true,
    },
    start: {
        type: String,
        required: true,
    },
    end: {
        type: String,
        required: true,
    },
}, {...getCommonOptions()});

addBy(schema)



const Slot = mongoose.model('Slot', schema);

export default Slot;
