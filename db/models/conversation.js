import mongoose from 'mongoose';
import {getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref:"User"
    }],
    room_id: {type: String},

    archived: {type: Boolean}
}, {...getCommonOptions()});


const Conversation = mongoose.model('Conversation', schema);

export default Conversation;
