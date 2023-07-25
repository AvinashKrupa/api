import mongoose from 'mongoose';
import Counter from './counter'
import {getCommonOptions} from "../../helpers/modelHelper";

const Schema = mongoose.Schema;

const schema = new Schema({
	name: {
		type: String,
		required: true
	},
	count: {
		type: Number,
		required: true,
		default: 1
	},
}, {...getCommonOptions()});


if (!schema.methods) {
	schema.methods = {}
}

export const getNextSequence = (name) => {
	return Counter.findOneAndUpdate({name: name},
		{$inc: {count: 1}},
		{
			new: true,
			upsert: true
		}).then(result => {
		return Promise.resolve(result.count)
	});


}

schema.index({name: 1})
export default mongoose.model('Counter', schema);
