import mongoose from 'mongoose';

const schema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
    },
    message: {type: String},
    room_id: {type: String}
}, {timestamps: {createdAt: 'created_at',updatedAt:"updated_at"}});


const Message = mongoose.model('Message', schema);

export default Message;
