import {translate} from "../../helpers/multilingual";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import Adminlog from "../../db/models/adminlog";

const index = (req, res) => {
        const translator = translate(req.headers.lang);
        let {limit = 20, page = 1} = req.body;
        let sort_key = "created_at"
        let sort_order = "desc"
        let skipAndLimit = []
        if (typeof limit !== 'undefined') {
            skipAndLimit = [{$skip: limit * (page - 1)},
                {$limit: limit}]
        } else {
            skipAndLimit = [{$skip: 0}]
        }
        let matchCond = {}
        return Adminlog.aggregate([
            {$match: matchCond},
            {
                $lookup: {
                    from: "users",
                    let: {userId: "$user_id"},
                    pipeline: [
                        {$match: {$expr: {$eq: ["$_id", "$$userId"]}},},
                        {$project: {_id: 1, name: {$concat: ["$first_name", " ", "$last_name"]}, avatar: "$dp"}}
                    ],
                    as: "actioner"
                }
            },
            {$unwind: "$actioner"},
            {
                $sort: {
                    [sort_key]: sort_order === "asc" ? 1 : -1
                }
            },
            {
                $facet: {
                    metadata: [{$count: "total"}],
                    docs: skipAndLimit
                }
            }
        ]).then(results => {
            let result = results[0]
            let finalResult = {};
            finalResult.docs = result.docs
            finalResult.total = result && result.metadata[0] ? result.metadata[0].total : 0;
            finalResult.limit = limit;
            finalResult.page = page;
            finalResult.sort_key = sort_key;
            finalResult.sort_order = sort_order;
            return jsonResponse(
                res,
                finalResult,
                translator.__("retrieve_success"),
                200
            );
        }).catch(error => errorResponse(error, res)); 
}

module.exports = {
    index,
}
