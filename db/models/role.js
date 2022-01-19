import mongoose from 'mongoose';
import User from './user';
import {addBy, getCommonOptions} from "../../helpers/modelHelper";

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    permissions: {
        grants: []
    },
    hierarchyLevel: {
        type: Number,
        required: true,
        default: 50
    }
}, {...getCommonOptions()});

addBy(schema)

schema.pre('remove', function (next) {
    Promise.all([
        User.findOne({
            "role_id": this._id
        }),
    ]).then((results) => {
        const has = results.find(obj => obj != null)
        if (has) {
            next(`Cannot delete ${this.name} because it has related records attached`)
        } else {
            next()
        }
    })
});
export default mongoose.model('Role', schema);
