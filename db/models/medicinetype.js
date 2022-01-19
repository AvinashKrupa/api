import mongoose from 'mongoose';

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, {timestamps: {createdAt: 'created_at', updatedAt: 'updated_at'}});

export default mongoose.model('Medicinetype', schema);
