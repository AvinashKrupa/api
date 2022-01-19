import mongoose from 'mongoose';
import {addBy, getCommonOptions} from "../../helpers/modelHelper";

let citySchema = new mongoose.Schema({
    id: {type: Number, unique: true},
    name: {type: String},
    latitude: {type: String},
    longitude: {type: String}
})

let stateSchema = new mongoose.Schema({
    id: {type: Number, unique: true},
    name: {type: String},
    state_code: {type: String},
    cities: [citySchema]
})
const schema = new mongoose.Schema({
    id: {type: Number, unique: true},
    name: {
        type: String,
    },
    iso3: {
        type: String,
        unique: true
    },
    phone_code: {
        type: String
    },
    capital: {
        type: String
    },
    currency: {
        type: String
    },
    states: [stateSchema]
}, {...getCommonOptions()});

addBy(schema)

const Country = mongoose.model('Country', schema);

export default Country;
