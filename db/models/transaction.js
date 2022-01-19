import mongoose from 'mongoose';
import {addBy, addSoftDelete, getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
    },
    razorpay_payment_id: {
        type: String,
    },
    razorpay_order_id: {
        type: String,
    },
    razorpay_payment_link_id: {
        type: String,
    },
    razorpay_signature: {
        type: String,
    },
    status: {
        type: String,
        enum: ["initiated", "cancelled", "refund_created", "refund_processed", "refund_failed", "order_paid"],
        default: "initiated"
    }
}, {...getCommonOptions()});

addBy(schema)
addSoftDelete(schema)

const Transaction = mongoose.model('Transaction', schema);

export default Transaction;
