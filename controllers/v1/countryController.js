import {translate} from "../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import Country from "../../db/models/country";

const index = (req, res) => {
    const translator = translate(req.headers.lang);
    Country.find({}, {id: 1, name: 1, _id: 0, iso3: 1}).then(countries => {
        return jsonResponse(
            res,
            countries,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

}
const getStateForCountry = (req, res) => {
    const translator = translate(req.headers.lang);
    let {countryId} = req.body
    Country.findOne({id: countryId}, {"states.cities": 0}).then(country => {
        return jsonResponse(
            res,
            country ? country.states : [],
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

}
const getCities = (req, res) => {
    const translator = translate(req.headers.lang);
    let {countryId, stateId} = req.body
    Country.findOne({id: countryId}).then(country => {
        let state = country && country.states && country.states.find(state => {
            return stateId == state.id
        })
        return jsonResponse(
            res,
            state ? state.cities : [],
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {

        return errorResponse(e, res, e.code);
    });

}
module.exports = {
    index,
    getStateForCountry,
    getCities
}
