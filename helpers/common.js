const randomString = (length) => {
    let result = "";
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};


let arrayToAssociativeObj = (array, basedOnKey) => {
    let obj = {}
    array.forEach(o => {
        obj[o[basedOnKey]] = o
    })
    return obj
}

const isNumber = (value) => {
    return typeof value === 'number' && isFinite(value);
}
const parseIp = (req) => {
    return (req.headers['x-forwarded-for'] || '').split(',').pop().trim() ||
        req.socket.remoteAddress
}
const getS3Url=()=>{
    return "https://" + process.env.S3_BUCKET_NAME.substr(0, process.env.S3_BUCKET_NAME.length - 1) + ".s3.ap-south-1.amazonaws.com/"
}
const capitalizeFirstLetter = (string) => {
    if (string)
        return string.charAt(0).toUpperCase() + string.slice(1);
    return string
}

module.exports = {
    randomString,
    arrayToAssociativeObj,
    isNumber, parseIp,
    capitalizeFirstLetter
};
