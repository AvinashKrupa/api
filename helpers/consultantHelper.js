import {getArrayFromFilterParams} from "./controllerHelper";


export const getConsultantAggregate = (options) => {
    let {filter, sort_key = "first_name", sort_order = "asc", limit = 10, page = 1} = options
    let skipAndLimit = []
    if (typeof limit !== 'undefined') {
        skipAndLimit = [{$skip: limit * (page - 1)},
            {$limit: limit}]
    } else {
        skipAndLimit = [{$skip: 0}]
    }
    let orOpts = {}
    let matchOpts = {}
    let userMatchOpts = {}
    if (filter) {
        let feeOpts = {}
        if (filter.text && filter.text !== "") {
            let regexExp = new RegExp(filter.text.replace(" ", "|"), "ig")

            orOpts = {
                $or: [
                    {first_name: {$regex: regexExp}},
                    {last_name: {$regex: regexExp}},
                    {"qualif.specl.title": {$regex: regexExp}}
                ]
            }
        }
        if (filter.fee_min) {
            feeOpts = {$gte: filter.fee_min}
        }
        if (filter.fee_max) {
            feeOpts = {...feeOpts, $lte: filter.fee_max}
        }
        if (Object.keys(feeOpts).length > 0) {
            matchOpts = {...matchOpts, "qualif.fee": {...feeOpts}}
        }
            filter.exp=parseInt(filter.exp)||0
            matchOpts = {...matchOpts, "qualif.exp": {$gte: parseInt(filter.exp)}}
        if (filter.specialities) {
            let speclArr = getArrayFromFilterParams(filter.specialities);
            if (speclArr.length > 0)
                matchOpts = {...matchOpts, "qualif.specl._id": {$in: speclArr}}
        }
        if (filter.excluded_id) {
            let exclusions = getArrayFromFilterParams(filter.excluded_id);
            if (exclusions.length > 0)
                matchOpts = {...matchOpts, "_id": {$nin: exclusions}}
        }
        if (filter.excluded_user_id) {
            let exclusions = getArrayFromFilterParams(filter.excluded_user_id);
            if (exclusions.length > 0)
                matchOpts = {...matchOpts, "user_id": {$nin: exclusions}}
        }
        if (filter.gender) {
            let genders = getArrayFromFilterParams(filter.gender, false);
            if (genders.length > 0)
                userMatchOpts = {
                    ...userMatchOpts,
                    "user.gender": {$in: genders}
                }
        }
        let languageArray = getArrayFromFilterParams(filter.language,false);
        if (languageArray.length > 0) {
            userMatchOpts = {
                ...userMatchOpts,
                "user.language.name": {$in: languageArray}
            }
        }
    }

    let sortKey = "$" + sort_key
    let aggregateRequest = [
        {
            $match: {
                status: "active",
                ...orOpts,
                ...matchOpts
            }
        },
        {
            $lookup: {
                from: "users",
                let: {baseId: "$user_id"},
                pipeline: [
                    {$match: {$expr: {$eq: ["$_id", "$$baseId"]}}},
                    {
                        $lookup: {
                            from: 'languages',
                            localField: 'language',
                            foreignField: '_id',
                            as: 'language'

                        }
                    },
                    {$project: {_id: 0, dp: 1, gender: 1, language: 1}}
                ],
                as: "user"
            }
        },
        {
            $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true
            }
        },
        {$match: {...userMatchOpts}},
        {
            $project: {
                ...getDoctorProjection(),
                "insensitive_sort_key": {"$toLower": sortKey}
            }
        },
        {
            $sort: {
                ["insensitive_sort_key"]: sort_order === "asc" ? 1 : -1
            }
        },
        {
            $facet: {
                metadata: [{$count: "total"}],
                docs: skipAndLimit
            }
        }
    ]
    return aggregateRequest

}

export const getDoctorProjection = () => {
    return {
        first_name: 1,
        last_name: 1,
        dp: '$user.dp',
        fee: "$qualif.fee",
        language: {
            $map:
                {
                    input: "$user.language",
                    as: "lang",
                    in: "$$lang.name"
                }
        },
        specialities: {
            $map:
                {
                    input: "$qualif.specl",
                    as: "specl",
                    in: "$$specl.title"
                }
        },
        exp: "$qualif.exp",
        country: '$address.country',
        city: '$address.city',
        gender: "$user.gender"
    }
}
