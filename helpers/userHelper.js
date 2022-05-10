import {setAttributes} from "./modelHelper";
import Patient from "../db/models/patient";
import Doctor from "../db/models/doctor";
import User from "../db/models/user";
import * as config from "../config/config";
import Speciality from "../db/models/speciality";
import {getAppointmentStats} from "./appointmentHelper";
import {getSlotsForShift, updateSlotsForShift} from "./slotHelper";
import {uploadFile, deleteFile, getPresignedUrl} from "./s3FileUploadHelper";
import {createAdminLog} from "./adminlogHelper";
import {compareObjGetDiff} from "./common";

export const createPatient = async (user, reqBody, createdByUser) => {
    return user.save().then(async userObj => {
        let patient = new Patient()
        setAttributes(reqBody, createdByUser, patient, true)
        patient.user_id = user._id
        let patient_data = await patient.save()
        user.profile_types.push(config.constants.USER_TYPE_PATIENT)

        //Using to record the log for the admin who is creating doctor profile it.
        let logData = {};
        logData.user_id = createdByUser._id;
        logData.module_name = config.constants.LOG_MSG_MODULE_NAME.PATIENT_PROFILE
        logData.title = config.constants.LOG_MSG_TITLE.PATIENT_PROFILE_CREATED;
        logData.message = config.constants.LOG_MESSAGE.PATIENT_PROFILE_CREATED;
        logData.message = logData.message.replace('{{admin}}', createdByUser.first_name +' '+ createdByUser.last_name);
        logData.message = logData.message.replace('{{patient_name}}', user.first_name +' '+ user.last_name);
        logData.record_id =  patient_data._id;
        await createAdminLog(logData);
        await user.save()
        return Promise.resolve(userObj)
    }).catch(e => {
        return Promise.reject(e)
    })
}

export const createAdminUser = async (user) => {
    return user.save().then(async userObj => {
        user.profile_types.push(config.constants.USER_TYPE_ADMIN)
        await user.save()
        return Promise.resolve(userObj)
    }).catch(e => {
        return Promise.reject(e)
    })
}

export const updateAdmin = async (userID, reqBody, updateByUser) => {
    //let skipPaths = ["mobile_number", "country_code", "type"]
    let skipPaths = ["type"];
    let user = await User.findOne({_id: userID})
    if (!user)
        return Promise.reject("No user found matching the specified id")
    setAttributes(reqBody, updateByUser, user, false, skipPaths)
    return user.save().then(async (userObj) => {
        userObj = await userObj.populate("language").execPopulate()
        return Promise.resolve(userObj);
    })
}


export const updatePatient = async (userID, reqBody, updateByUser) => {
    let skipPaths = ["mobile_number", "country_code", "type"]

    let user = await User.findOne({_id: userID})
    if (!user)
        return Promise.reject("No user found matching the specified id")

    setAttributes(reqBody, updateByUser, user, false, skipPaths)
    return user.save().then(async (userObj) => {
        userObj=await userObj.populate("language").execPopulate()
        let patient = await Patient.findOne({user_id: userID})
        if (!patient)
            return Promise.reject("No patient found matching the specified id")
        setAttributes(reqBody, updateByUser, patient, false, skipPaths)
        patient = await patient.save()
        return Promise.resolve({user: userObj, additional_info: patient})
    })
}

export const updateDoctor = async (userID, reqBody, updateByUser, timezone) => {
    let skipPaths = ["mobile_number", "country_code", "type", "specl","status"]

    let user = await User.findOne({_id: userID})
    if (!user)
        return Promise.reject("No user found matching the specified id")

    setAttributes(reqBody, updateByUser, user, false, skipPaths)
    return user.save().then(async (userObj) => {
        userObj=await userObj.populate("language").execPopulate()
        let doctor = await Doctor.findOne({user_id: userID})
        if (!doctor)
            return Promise.reject("No doctor found matching the specified id")
        if (reqBody.avail && !reqBody.avail.slots) {
            let existingShift = doctor.avail.shift
            let existingSlots = doctor.avail.slots
            setAttributes(reqBody, updateByUser, doctor, false, skipPaths)
            let updatedSlots = await updateSlotsForShift(existingShift, reqBody.avail.shift, existingSlots, timezone)
            doctor.avail.slots = updatedSlots
        } else {
            setAttributes(reqBody, updateByUser, doctor, false, skipPaths)
        }

        if (reqBody.qualif && reqBody.qualif.specl && reqBody.qualif.specl.length > 0) {
            doctor.qualif.specl = await Speciality.find({_id: {$in: reqBody.qualif.specl}}, {_id: 1, title: 1})
        }

        doctor = await doctor.save()
        doctor=await doctor
        .populate({ path: 'qualif.dept_id', select:"title",options: { withDeleted:true}})
        .populate({ path: 'qualif.quals qualif.highest_qual', select:"name",options: { withDeleted:true}})
            .execPopulate()
        return Promise.resolve({user: userObj, additional_info: doctor})
    })
}

export const updateDoctor2 = async (userID, reqBody, updateByUser, timezone, files) => {
    let skipPaths = ["mobile_number", "country_code", "type", "specl","status"]

    let user = await User.findOne({_id: userID});
    if (!user)
        return Promise.reject("No user found matching the specified id")

    let old_user_data = user;
    setAttributes(reqBody, updateByUser, user, false, skipPaths)
    return user.save().then(async (userObj) => {
        userObj=await userObj.populate("language").execPopulate()
        let doctor = await Doctor.findOne({user_id: userID})
        let logData;
        //Using to Record the log if admin will change fee of the doctor.
        if(reqBody.qualif && doctor.qualif ) {
            if( parseInt(doctor.qualif.fee) !== parseInt(reqBody.qualif.fee)) {
                logData = {};
                logData.user_id = updateByUser._id;
                logData.module_name = config.constants.LOG_MSG_MODULE_NAME.DOCTOR_PROFILE
                logData.title = config.constants.LOG_MSG_TITLE.DOCTOR_FEE_UPDATED;
                logData.message = config.constants.LOG_MESSAGE.DOCTOR_FEE_UPDATED;
                logData.message = logData.message.replace('{{admin}}', updateByUser.first_name +' '+ updateByUser.last_name);
                logData.message = logData.message.replace('{{old_fee}}', doctor.qualif.fee);
                logData.message = logData.message.replace('{{new_fee}}', reqBody.qualif.fee);
                logData.record_id =  doctor._id;
                await createAdminLog(logData);
            }
        }

        // Using to track the changes for the admin record
        let obj1 = reqBody;
        let obj2 = JSON.parse(JSON.stringify(doctor));
        obj2.mobile_number = old_user_data.mobile_number;
        obj2.email = old_user_data.email;
        obj2.dob = old_user_data.dob;
        obj2.gender = old_user_data.gender;

        delete obj2._id;
        delete obj2.created_by;
        delete obj2.updated_by;
        delete obj2.user_id;
        delete obj2.created_at;
        delete obj2.updated_at;
        delete obj2.__v;
        delete obj2.set_consultation;
        delete obj2.set_consultation;
        delete obj2.huno_id;
        delete obj2.status;
        obj2.qualif.specl = obj2.qualif.specl.map((obj) => obj._id);
        let objsResult = compareObjGetDiff.map(obj2, obj1);
        logData = {};
        logData.user_id = updateByUser._id;
        logData.module_name = config.constants.LOG_MSG_MODULE_NAME.DOCTOR_PROFILE
        logData.title = config.constants.LOG_MSG_TITLE.DOCTOR_PROFILE_UPDATED;
        logData.message = config.constants.LOG_MESSAGE.DOCTOR_PROFILE_UPDATED;
        logData.message = logData.message.replace('{{admin}}', updateByUser.first_name +' '+ updateByUser.last_name);
        logData.message = logData.message.replace('{{doctor_name}}', obj2.first_name +' '+ obj2.last_name);
        logData.profile_fields = JSON.stringify(objsResult);
        logData.record_id =  doctor._id;
        await createAdminLog(logData);
        if(obj1.qualif && typeof obj1.qualif.specl !== 'undefined') {
            obj1.qualif.specl = obj1.qualif.specl.sort();
            obj2.qualif.specl = obj2.qualif.specl.sort();
            if(obj1.qualif.specl.length !== obj2.qualif.specl.length) {
                logData = {};
                logData.user_id = updateByUser._id;
                logData.module_name = config.constants.LOG_MSG_MODULE_NAME.DOCTOR_PROFILE
                logData.title = config.constants.LOG_MSG_TITLE.DOCTOR_SPECIALTY_UPDATED;
                logData.message = config.constants.LOG_MESSAGE.DOCTOR_SPECIALTY_UPDATED;
                logData.message = logData.message.replace('{{admin}}', updateByUser.first_name +' '+ updateByUser.last_name);
                logData.message = logData.message.replace('{{doctor_name}}', obj2.first_name +' '+ obj2.last_name);
                logData.record_id =  doctor._id;
                await createAdminLog(logData);
            }
        }

        if (!doctor)
            return Promise.reject("No doctor found matching the specified id")
        if (reqBody.avail) {
            let existingShift = doctor.avail.shift
            let existingSlots = doctor.avail.slots
            setAttributes(reqBody, updateByUser, doctor, false, skipPaths)
            let updatedSlots = await updateSlotsForShift(existingShift, reqBody.avail.shift, existingSlots, timezone)
            doctor.avail.slots = updatedSlots
        } else {
            setAttributes(reqBody, updateByUser, doctor, false, skipPaths)
        }

        if (reqBody.qualif && reqBody.qualif.specl && reqBody.qualif.specl.length > 0) {
            doctor.qualif.specl = await Speciality.find({_id: {$in: reqBody.qualif.specl}}, {_id: 1, title: 1})
        }
 
        //Using to upload medical certificate over s3 bucket
        let s3_res;
        if ( typeof files.medical_cert_file !== 'undefined' && files.medical_cert_file.length != 0) {
            //Deleting medical_cert_file doc file from s3 bucket
            await deleteFile(doctor.medical_cert_url, 'certificates');  
            let medical_cert_file =  files.medical_cert_file.pop();
            medical_cert_file.originalname = reqBody.mobile_number+'.'+ medical_cert_file.originalname.substring(medical_cert_file.originalname.lastIndexOf('.') + 1) ;
            s3_res = await uploadFile(medical_cert_file, 'certificates');
            doctor.medical_cert_url = s3_res.Location ; 
        }
        //Using to upload digital signature file over s3 bucket
        if ( typeof files.digital_signature_file !== 'undefined' && files.digital_signature_file.length != 0) { 
            //Deleting digital_signature_file doc file from s3 bucket
            await deleteFile(doctor.digital_signature_url, 'signatures');  
            let digital_signature_file =  files.digital_signature_file.pop();
            digital_signature_file.originalname = reqBody.mobile_number+'.'+ digital_signature_file.originalname.substring(digital_signature_file.originalname.lastIndexOf('.') + 1) ;
            s3_res = await uploadFile(digital_signature_file, 'signatures');
            doctor.digital_signature_url = s3_res.Location ;  
        }

        doctor = await doctor.save()
        doctor=await doctor
        .populate({ path: 'qualif.dept_id', select:"title",options: { withDeleted:true}})
        .populate({ path: 'qualif.quals qualif.highest_qual', select:"name",options: { withDeleted:true}})
            .execPopulate()
        return Promise.resolve({user: userObj, additional_info: doctor})
    })
}

export const createDoctor = async (user, reqBody, createdByUser, autoApprove=false,addSlotsFromShift=false) => {
    /*
    2. Create doctor entry in doctor table
    3. return user object
     */
    return user.save().then(async userObj => {
        let doctor = new Doctor()
        setAttributes(reqBody, createdByUser, doctor, true, ["specl"])
        if(addSlotsFromShift) {
            let updatedSlots = await getSlotsForShift(reqBody.avail.shift, "Asia/Calcutta")
            doctor.avail.slots = updatedSlots
        }
        // Set default consultation number randomly during doctor registeration
        doctor.set_consultation = Math.floor(Math.random() * 6) + 1 ;
        if (reqBody.qualif.specl.length > 0) {
            doctor.qualif.specl = await Speciality.find({_id: {$in: reqBody.qualif.specl}}, {_id: 1, title: 1})
        }
        // doctor.qualif.exp = moment(reqBody.qualif.reg_date).diff(moment(),"years")
        doctor.user_id = user._id
        if(autoApprove)
            doctor.status="active"
        await doctor.save()
        user.profile_types.push(config.constants.USER_TYPE_DOCTOR);
        await user.save()
        return Promise.resolve(userObj)
    }).catch(e => {
        return Promise.reject(e)
    })
}

export const createDoctor2 = async (user, reqBody, createdByUser, autoApprove=false,addSlotsFromShift=false, files) => {
    /*
    2. Create doctor entry in doctor table
    3. return user object
     */
    return user.save().then(async userObj => {
        let doctor = new Doctor()
        setAttributes(reqBody, createdByUser, doctor, true, ["specl"])
        if(addSlotsFromShift) {
            let updatedSlots = await getSlotsForShift(reqBody.avail.shift, "Asia/Calcutta")
            doctor.avail.slots = updatedSlots
        }
        // Set default consultation number randomly during doctor registeration
        doctor.set_consultation = Math.floor(Math.random() * 6) + 1 ;
  
        //Using to upload medical certificate over s3 bucket
        let s3_res;
        if ( typeof files.medical_cert_file !== 'undefined' && files.medical_cert_file.length != 0) {  
            let medical_cert_file =  files.medical_cert_file.pop();
            medical_cert_file.originalname = reqBody.mobile_number+'.'+ medical_cert_file.originalname.substring(medical_cert_file.originalname.lastIndexOf('.') + 1) ;
            s3_res = await uploadFile(medical_cert_file, 'certificates');
            doctor.medical_cert_url = s3_res.Location ; 
        }
        //Using to upload digital signature file over s3 bucket
        if ( typeof files.digital_signature_file !== 'undefined' && files.digital_signature_file.length != 0) { 
            let digital_signature_file =  files.digital_signature_file.pop();
            digital_signature_file.originalname = reqBody.mobile_number+'.'+ digital_signature_file.originalname.substring(digital_signature_file.originalname.lastIndexOf('.') + 1) ;
            s3_res = await uploadFile(digital_signature_file, 'signatures');
            doctor.digital_signature_url = s3_res.Location ;  
        }

        if (reqBody.qualif.specl.length > 0) {
            doctor.qualif.specl = await Speciality.find({_id: {$in: reqBody.qualif.specl}}, {_id: 1, title: 1})
        }
        // doctor.qualif.exp = moment(reqBody.qualif.reg_date).diff(moment(),"years")
        doctor.user_id = user._id
        if(autoApprove)
            doctor.status="active"
        let doctorData = await doctor.save();
        user.profile_types.push(config.constants.USER_TYPE_DOCTOR);

        //Using to record the log for the admin who is creating doctor profile it.
        let logData = {};
        logData.user_id = createdByUser._id;
        logData.module_name = config.constants.LOG_MSG_MODULE_NAME.DOCTOR_PROFILE
        logData.title = config.constants.LOG_MSG_TITLE.DOCTOR_PROFILE_CREATED;
        logData.message = config.constants.LOG_MESSAGE.DOCTOR_PROFILE_CREATED;
        logData.message = logData.message.replace('{{admin}}', createdByUser.first_name +' '+ createdByUser.last_name);
        logData.message = logData.message.replace('{{doctor_name}}', doctorData.first_name +' '+ doctorData.last_name);
        logData.record_id =  doctorData._id;
        await createAdminLog(logData);

        await user.save()
        return Promise.resolve(userObj)
    }).catch(e => {
        return Promise.reject(e)
    })
}


export const getAdditionalInfo = async (user_id, profile_type, options = {}) => {
    let patient_exclusions_default = '-user_id -created_at -created_by -updated_at -updated_by'
    let doctor_exclusions_default = '-user_id -created_at -created_by -updated_at -updated_by -avail'

    let {
        load_doctor_stats = false,
        patient_exclusions = '',
        doctor_exclusions = '',
    } = options
    let additionalInfo
    switch (profile_type) {
        case config.constants.USER_TYPE_PATIENT:
            additionalInfo = await Patient.findOne({user_id: user_id}, patient_exclusions_default + " " + patient_exclusions)
            break;
        case config.constants.USER_TYPE_DOCTOR:
            additionalInfo = await Doctor.findOne({user_id: user_id}, doctor_exclusions_default + " " + doctor_exclusions)
                .populate({ path: 'qualif.dept_id', select:"title",options: { withDeleted:true}})
                .populate({ path: 'qualif.quals qualif.highest_qual', select:"name",options: { withDeleted:true}})
                .then(async doctor => {
                    if(doctor.digital_signature_url) {
                        doctor.digital_signature_url = await getPresignedUrl(doctor.digital_signature_url);
                    }
                    if(doctor.medical_cert_url) {
                        doctor.medical_cert_url = await getPresignedUrl(doctor.medical_cert_url);
                    }   
                    if (load_doctor_stats) {
                        let appointment_stats = await getAppointmentStats(doctor._id)
                        return Promise.resolve({...doctor.toJSON(), appointment_stats: appointment_stats})
                    } else {
                        return Promise.resolve({...doctor.toJSON()})
                    }
            })
    }
    return Promise.resolve(additionalInfo)
}

