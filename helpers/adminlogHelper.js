//import * as config from "../config/config";
import Adminlog from "../db/models/adminlog";

async function createAdminLog(data) {
    if(typeof data.profile_fields === 'undefined') {
        data.profile_fields= '';
    }
    
    let adminLog = new Adminlog({
        user_id: data.user_id,
        module_name: data.module_name,
        title: data.title,
        message: data.message,
        record_id: data.record_id,
        profile_fields: data.profile_fields
    })
    return await adminLog.save();
}

module.exports = {
    createAdminLog
}
