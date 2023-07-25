import mongoose from 'mongoose'
import _ from 'lodash'
import autoPopulate from "mongoose-autopopulate"

let mongoose_delete = require('mongoose-delete');
export const addBy = (schema) => {
    schema.add({
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            autopopulate: {maxDepth: 1, select: 'first_name last_name'}
        }
    })
    schema.add({
        updated_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            autopopulate: {maxDepth: 1, select: 'first_name last_name'}
        }
    })
    schema.plugin(autoPopulate)
}
export const addSoftDelete = (schema) => {
    schema.plugin(mongoose_delete, {overrideMethods: 'all'})
}

export const getCommonOptions = (autoSelect = false) => {
    return {timestamps: {createdAt: 'created_at', updatedAt: 'updated_at'}, selectPopulatedPaths: autoSelect, id: false}
}
export const addressType = () => {
    return {
        line1: {
            type: String,
        },
        line2: {
            type: String
        },
        city: {
            type: String,
        },
        country: {
            type: String,
        },
        state: {
            type: String
        },
    }
}
export const getLookupForByTags = () => {
    return [
        {
            $lookup: {
                from: "users",
                let: {userId: "$created_by"},
                pipeline: [
                    {$match: {$expr: {$eq: ["$_id", "$$userId"]}},},
                    {$project: {_id: 1, first_name: 1, last_name: 1}}
                ],
                as: "created_by"
            }
        },
        {
            $unwind: {
                path: "$created_by",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "users",
                let: {userId: "$updated_by"},
                pipeline: [
                    {$match: {$expr: {$eq: ["$_id", "$$userId"]}},},
                    {$project: {_id: 1, first_name: 1, last_name: 1}}
                ],
                as: "updated_by"
            }
        },
        {
            $unwind: {
                path: "$updated_by",
                preserveNullAndEmptyArrays: true
            }
        },
    ]
}


/**
 * Add at and by info for any model.
 * @param model
 * @param userModel
 * @param addCreationDetails
 * @returns {*}
 */
export const addByInfo = (model, userModel, addCreationDetails = true) => {
    model.updated_by = userModel._id
    if (addCreationDetails) {
        model.created_by = userModel._id
    }
}

/*
 * Compare two objects by reducing an array of keys in obj1, having the
 * keys in obj2 as the intial value of the result. Key points:
 *
 * - All keys of obj2 are initially in the result.
 *
 * - If the loop finds a key (from obj1, remember) not in obj2, it adds
 *   it to the result.
 *
 * - If the loop finds a key that are both in obj1 and obj2, it compares
 *   the value. If it's the same value, the key is removed from the result.
 */
export const getObjectDiff = (obj1, obj2) => {
    const diff = Object.keys(obj1).reduce((result, key) => {
        if (!obj2.hasOwnProperty(key)) {
            result.push(key);
        } else if (_.isEqual(obj1[key], obj2[key])) {
            const resultKeyIndex = result.indexOf(key);
            result.splice(resultKeyIndex, 1);
        }
        return result;
    }, Object.keys(obj2));

    return diff;
}

export const setAttributes = (body, user, model, includeCreate = false, skipPath) => {
    let omitPaths = ["updated_by", "created_by", "_id", "created_at", "updated_at","__v"]
    if (skipPath) {
        omitPaths.push(...skipPath)
    }
    const payload = _.extend({
        updated_by: (user) ? user._id : null
    }, _.omit(body, omitPaths));

    if (includeCreate) {
        payload.created_by = (user) ? user._id : null
    }
    let keys = _.keys(payload);
    _.each(keys, function (key) {
        if (_.isArray(model[key])) {
            model[key].splice(0, model[key].length)
            _.each(payload[key], function (value) {
                model[key].push(value)
            })
        } else if (_.isObject(model[key])) {
            if (_.isObject(payload[key])){
                model[key] = {...model[key].toJSON(), ...payload[key]}
            }
            else
                model[key] = payload[key]
        } else {
            model[key] = payload[key]
        }
    })
    return model
}
