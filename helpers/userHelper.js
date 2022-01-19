import {setAttributes} from "./modelHelper";
import Patient from "../db/models/patient";
import Doctor from "../db/models/doctor";
import User from "../db/models/user";
import * as config from "../config/config";
import Speciality from "../db/models/speciality";
import {getAppointmentStats} from "./appointmentHelper";
import {getSlotsForShift, updateSlotsForShift} from "./slotHelper";

export const createPatient = async (user, reqBody, createdByUser) => {
    return user.save().then(async userObj => {
        let patient = new Patient()
        setAttributes(reqBody, createdByUser, patient, true)
        patient.user_id = user._id
        await patient.save()
        user.profile_types.push(config.constants.USER_TYPE_PATIENT)
        await user.save()
        return Promise.resolve(userObj)
    }).catch(e => {
        return Promise.reject(e)
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
        doctor = await doctor.save()
          doctor=await doctor
            .populate({ path: 'qualif.dept_id', select:"title",options: { withDeleted:true}})
            .populate({ path: 'qualif.quals qualif.highest_qual', select:"name",options: { withDeleted:true}})
                .execPopulate()
        return Promise.resolve({user: userObj, additional_info: doctor})
    })
}

export const createDoctor = async (user, reqBody, createdByUser,autoApprove=false,addSlotsFromShift=false) => {
    /*
    2. Create doctor entry in doctor table
    3. return user object
     */
    return user.save().then(async userObj => {
        let doctor = new Doctor()
        setAttributes(reqBody, createdByUser, doctor, true, ["specl"])
       if(addSlotsFromShift){
           let updatedSlots = await getSlotsForShift(reqBody.avail.shift, "Asia/Calcutta")
           doctor.avail.slots = updatedSlots
       }

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

