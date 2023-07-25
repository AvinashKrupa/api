const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    region: 'ap-south-1'
});
const getFolder = (type) => {
    let folder = "images"
    let acl = 'public-read'
    switch (type) {
        case "profile":
            folder = "images/profile-images"
            break;
        case "speciality":
            folder = "images/specialities"
            break
        case "slider":
            folder = "images/sliders"
            break
        case "report":
            folder = "documents/reports"
            break
        case "prescriptions_pdf":
            folder = "documents/prescriptions_pdf"
            break
        case "signatures":
            folder = "documents/signatures"
            acl = 'private';
            break
        case "certificates":
            folder = "documents/certificates"
            acl = 'private';
            break
    }
    return {bucket:process.env.S3_BUCKET_NAME+folder,acl:acl}
}
const uploadFile = (multerFile, type) => {
    let customParams = getFolder(type)

    const params = {
        Bucket:  customParams.bucket,
        Key: new Date().getTime() + "_" + multerFile.originalname,
        Body: multerFile.buffer,
        ACL: customParams.acl
    };
    return s3.upload(params).promise()

};

const getPresignedUrl = (fileUrl) => {
    let splits=fileUrl.split("/")
    const key = splits[splits.length-1];

    let type=""
    for(let i=3;i<splits.length-1;i++){
        type=type+splits[i]
        if(i<splits.length-2)
            type=type+"/"
    }
    const params = {
        Bucket: process.env.S3_BUCKET_NAME+type,
        Key: key,
        Expires:300
    };
    return s3.getSignedUrl('getObject', params);

};

const deleteFile = (fileUrl, type) => {
    const key = fileUrl.substring(fileUrl.lastIndexOf('/')+1);
    let customParams = getFolder(type)
    const params = {
        Bucket: customParams.bucket,
        Key: key,
    };
    return s3.deleteObject(params).promise()

};

/**
 * function to get doc url/download a file from S3 bucket.
 */
const getDocUrlFromS3 = (type, fileName) => {
    let customParams = getFolder(type)
    const params = {
        Bucket: customParams.bucket,
        Key: fileName,
        Expires:300
    };
    return s3.getSignedUrl('getObject', params);
};

module.exports = {
    uploadFile,
    deleteFile,
    getPresignedUrl,
    getDocUrlFromS3,
}
