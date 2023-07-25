import {translate} from "../../helpers/multilingual";
import Conversation from "../../db/models/conversation";
import {errorResponse, jsonResponse} from "../../helpers/responseHelper";
import Message from "../../db/models/message";
import {validate} from "../../helpers/validator";
import {HandleError} from "../../helpers/errorHandling";
import mongoose from "mongoose";

const ObjectId = mongoose.Types.ObjectId;

const getConversations = (req, res) => {
    const translator = translate(req.headers.lang);
    let myLoginId = "612363d240eef4f51b11e4de"
    if (res.locals.user) {
        myLoginId = res.locals.user._id
    }
    Conversation.aggregate([
        {
            $match: {
                participants: {$in: [ObjectId(myLoginId)]}
            }
        },
        {
            $lookup: {
                from: "users",
                let: {baseId: "$participants"},
                pipeline: [
                    {$match: {$expr: {$in: ["$_id", "$$baseId"]}},},
                    {$project: {first_name: 1, last_name: 1, dp: 1}}
                ],
                as: "participants"
            }
        },
        {
            $lookup: {
                from: "messages",
                let: {baseId: "$room_id"},
                pipeline: [
                    {$match: {$expr: {$eq: ["$room_id", "$$baseId"]}},},
                    {$sort: {"created_at": -1}},
                    {$limit: 1},
                    {$project: {message: 1, created_at: 1}}
                ],
                as: "last_message"
            }
        },
        {
            $unwind: {
                path: "$last_message"
            }
        },
        {
            $sort: {
                updated_at: -1
            }
        }
    ]).then(conversations => {

        return jsonResponse(
            res,
            conversations,
            translator.__("retrieve_success"),
            200
        );
    }).catch((e) => {

        return errorResponse(e, res, e.code);
    });

}


const getMessages = async (req, res) => {
    const translator = translate(req.headers.lang);
    const validations = {
        room_id: "required",
    };
    validate(req.body, validations)
        .then((matched) => {
            if (!matched.status) {
                throw new HandleError(matched.data, 422);
            }
            let {limit = 10, page = 1, room_id} = req.body
            let sort_key = "created_at"
            let sort_order = "desc"
            let skipAndLimit = []
            if (typeof limit !== 'undefined') {
                skipAndLimit = [{$skip: limit * (page - 1)},
                    {$limit: limit}]
            } else {
                skipAndLimit = [{$skip: 0}]
            }

            let matchCond = {room_id: room_id}

            return Message.aggregate([
                {$match: matchCond},
                {
                    $lookup: {
                        from: "users",
                        let: {userId: "$sender"},
                        pipeline: [
                            {$match: {$expr: {$eq: ["$_id", "$$userId"]}},},
                            {$project: {_id: 1, name: {$concat: ["$first_name", " ", "$last_name"]}, avatar: "$dp"}}
                        ],
                        as: "sender"
                    }
                },
                {$unwind: "$sender"},
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
        }).catch((e) => {
        return errorResponse(e, res, e.code);
    });

};

module.exports = {
    getConversations,
    getMessages
}
