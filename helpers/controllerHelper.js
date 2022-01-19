import mongoose from "mongoose";
const ObjectId = mongoose.Types.ObjectId;
export function getArrayFromFilterParams(obj, convertToMongoObject = true) {
    let finalArray = []
    if (obj === "" || !obj)
        return finalArray
    if (!Array.isArray(obj)) {
        if (obj !== "All") {
            finalArray.push(convertToMongoObject ? ObjectId(obj) : obj)
        }
    } else {
        obj.forEach(objModel => {
            finalArray.push(convertToMongoObject ? ObjectId(objModel) : objModel)
        })
    }
    return finalArray
}
