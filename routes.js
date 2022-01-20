import {hasTempAccess, isAuthenticated, shouldRefreshToken} from "./middlewares/authentication";
import {hasPermission} from "./middlewares/authorization";

const router = require('express').Router();
const multer = require('multer');
const upload = multer();
const authController = require("./controllers/v1/authController")
const appointmentController = require("./controllers/v1/appointmentController")
const chatController = require("./controllers/v1/chatController")
const countryController = require("./controllers/v1/countryController")
const categoryController = require("./controllers/v1/admin/categoryController")
const couponController = require("./controllers/v1/admin/couponController")
const configController = require("./controllers/v1/admin/configController")
const deptController = require("./controllers/v1/admin/deptController")
const dashboardController = require("./controllers/v1/admin/dashboardController")
const doctorController = require("./controllers/v1/doctor/doctorController")
const filesController = require("./controllers/v1/fileController")
const labController = require("./controllers/v1/lab/labController")
const langController = require("./controllers/v1/admin/langController")
const patientController = require("./controllers/v1/patient/patientController")
const adminController = require("./controllers/v1/admin/adminController")
const qualController = require("./controllers/v1/admin/qualController")
const slotController = require("./controllers/v1/slotController")
const specialityController = require("./controllers/v1/admin/specialityController")
const sliderController = require("./controllers/v1/admin/sliderController")
const transactionController = require("./controllers/v1/transactionController")
const userController = require("./controllers/v1/userController")
const medicineController = require("./controllers/v1/medicineController")
const prescriptionController = require("./controllers/v1/prescriptionController")
const notificationController = require("./controllers/v1/notificationController")
const viewController = require("./controllers/v1/viewController")
const termsandconditionController = require("./controllers/v1/termsandconditionController")

router.get('/', (req, res) => {
    res.send(`${process.env.APP_NAME} Application is running on this Server.`);
});

//----------------------Admin------------------------------------------//
router.post('/v1/admin/cleanupUserRecords', hasPermission("admin"), adminController.cleanupUserRecords);
router.post('/v1/admin/bookAppointment', hasPermission("admin"), adminController.bookAppointment);

//----------------------Auth------------------------------------------//
router.post('/v1/auth/sendOtp', authController.sendOtp);
router.post('/v1/auth/verifyOtp', authController.verifyOtp);

router.post('/v1/auth/admin/login', authController.adminLogin);
router.post('/v1/auth/login', authController.login);

router.post('/v1/auth/registerPatient', hasTempAccess(), authController.registerUser);
router.post('/v1/auth/registerDoctor', hasTempAccess(), authController.registerUser);

router.post('/v1/auth/logout', isAuthenticated(), authController.logout);
router.post('/v1/auth/refreshAccessToken', shouldRefreshToken(), authController.refreshAccessToken);

//----------------------Appointment------------------------------------------//
router.get('/v1/appointments', isAuthenticated(), appointmentController.index);
router.post('/v2/appointments', isAuthenticated(), appointmentController.index2);
router.post('/v1/appointment/getDetails', isAuthenticated(), appointmentController.getDetails);
router.post('/v1/appointment/addDoctor', isAuthenticated(), appointmentController.addDoctor);
router.post('/v1/appointment/removeAdditionalDoctor', isAuthenticated(), appointmentController.removeAdditionalDoctor);
router.post('/v1/appointment/changeStatus', isAuthenticated(), appointmentController.changeStatus);
router.post('/v1/appointment/rescheduleAppointment', hasPermission("admin"), appointmentController.rescheduleAppointment);
router.post('/v1/appointment/canJoinAppointment', isAuthenticated(), appointmentController.canJoinAppointment);
router.post('/v1/appointment/joinAppointment', isAuthenticated(), appointmentController.joinAppointment);
router.post('/v1/appointment/endAppointment', isAuthenticated(), appointmentController.endAppointment);

//----------------------Chats------------------------------------------//
router.post('/v1/chat/getConversations', isAuthenticated(), chatController.getConversations);
router.post('/v1/chat/getMessages', isAuthenticated(), chatController.getMessages);

//---------------------- Category ------------------------------------------//
router.get('/v1/categories', hasTempAccess(), categoryController.index);
router.post('/v1/category/addNew', hasPermission("admin"), categoryController.addNew);
router.post('/v1/category/update', hasPermission("admin"), categoryController.update);
router.post('/v1/category/changeStatus', hasPermission("admin"), categoryController.changeStatus);
router.post('/v1/category/deleteRecord', hasPermission("admin"), categoryController.deleteRecord);

//---------------------- Coupon ------------------------------------------//
router.get('/v1/coupons', isAuthenticated(), couponController.index);
router.post('/v1/coupon/addNew', hasPermission("admin"), couponController.addNew);
router.post('/v1/coupon/deleteRecord', hasPermission("admin"), couponController.deleteRecord);
router.post('/v1/coupon/changeStatus', hasPermission("admin"), couponController.changeStatus);
router.post('/v1/coupon/update', hasPermission("admin"), couponController.update);
router.post('/v1/coupon/checkDiscount', isAuthenticated(), couponController.checkDiscount);

//---------------------- Configuration ------------------------------------------//
router.get('/v1/configs', hasPermission("admin"), configController.index);
router.get('/v1/about_us', configController.getAboutUs);
router.post('/v1/config/update', hasPermission("admin"), configController.update);
router.post('/v1/config/getDetails', isAuthenticated(), configController.getDetails);
router.get('/v1/config/getCurrentVersions', configController.getCurrentVersions);
router.post('/v1/config/updateVersion',hasPermission("admin"), configController.updateVersion);

//----------------------Country State City------------------------------------------//
router.get('/v1/country', hasTempAccess(), countryController.index);
router.post('/v1/state', hasTempAccess(), countryController.getStateForCountry);
router.post('/v1/city', hasTempAccess(), countryController.getCities);


//----------------------Department------------------------------------------//
router.get('/v1/dashboard/headerData',hasPermission("admin"), dashboardController.headerData);

//----------------------Department------------------------------------------//
router.get('/v1/departments', hasTempAccess(), deptController.index);
router.post('/v1/department/addNew', hasPermission("admin"), deptController.addNew);
router.post('/v1/department/update', hasPermission("admin"), deptController.update);
router.post('/v1/department/changeStatus', hasPermission("admin"), deptController.changeStatus);
router.post('/v1/department/deleteRecord', hasPermission("admin"), deptController.deleteRecord);

//---------------------- Doctor ------------------------------------------//
router.get('/v1/doctors', isAuthenticated(), doctorController.index);
router.post('/v2/doctors', isAuthenticated(), doctorController.index2);
router.get('/v1/doctor/homeContent', isAuthenticated(), doctorController.getHomeContent);
router.post('/v1/doctor/getAppointments', isAuthenticated(), doctorController.getAppointments);
router.post('/v1/doctor/getDoctorDetails', isAuthenticated(), doctorController.getDoctorDetails);
router.post('/v1/doctor/updateSchedule', isAuthenticated(), doctorController.updateSchedule);
router.post('/v1/doctor/changeStatus', hasPermission("admin"), doctorController.changeStatus);

//----------------------File handler------------------------------------------//
router.post('/v1/fileUpload', hasTempAccess(), upload.single('file'), filesController.fileUpload);
router.post('/v1/getPublicLinkFile', isAuthenticated(), filesController.getPublicLinkFile);

//---------------------- Lab ------------------------------------------//
router.post('/v1/labs', isAuthenticated(), labController.index);
router.post('/v1/lab/getAppointments', isAuthenticated(), labController.getAppointments);
router.post('/v1/lab/uploadReport', isAuthenticated(), upload.array('file'), labController.uploadReport);

//----------------------Languages------------------------------------------//
router.get('/v1/languages', hasTempAccess(), langController.index);
router.post('/v1/language/addNew', hasPermission("admin"), langController.addNew);
router.post('/v1/language/update', hasPermission("admin"), langController.update);
router.post('/v1/language/changeStatus', hasPermission("admin"), langController.changeStatus);
router.post('/v1/language/deleteRecord', hasPermission("admin"), langController.deleteRecord);

//---------------------- Patient ------------------------------------------//
router.get('/v1/patients', isAuthenticated(), patientController.index);
router.get('/v1/patient/homeContent', isAuthenticated(), patientController.getHomeContent);
router.post('/v1/patient/getTopConsultants', isAuthenticated(), patientController.getTopConsultants);
router.post('/v1/patient/bookAppointment', isAuthenticated(), patientController.bookAppointment);
router.post('/v1/patient/getAppointments', isAuthenticated(), patientController.getAppointments);
router.post('/v1/patient/getAppointmentDetails', isAuthenticated(), patientController.getAppointmentDetails);
router.post('/v1/patient/cancelAppointment', isAuthenticated(), patientController.cancelAppointment);
router.post('/v1/patient/uploadReport', isAuthenticated(), upload.single('file'), patientController.uploadReport);
router.post('/v1/patient/deleteReport', isAuthenticated(),  patientController.deleteReport);
router.post('/v1/patient/getReports', isAuthenticated(), patientController.getReports);
router.post('/v1/patient/getPrescriptions', isAuthenticated(), patientController.getPrescriptions);
router.post('/v1/patient/changeStatus', hasPermission("admin"), patientController.changeStatus);
router.get('/v1/patient/getCountOfCancelAppointment', isAuthenticated(), patientController.getCountOfCancelAppointment);


//----------------------Qualifications------------------------------------------//
router.get('/v1/qualifications', hasTempAccess(), qualController.index);
router.post('/v1/qualification/addNew', hasPermission("admin"), qualController.addNew);
router.post('/v1/qualification/update', hasPermission("admin"), qualController.update);
router.post('/v1/qualification/changeStatus', hasPermission("admin"), qualController.changeStatus);
router.post('/v1/qualification/deleteRecord', hasPermission("admin"), qualController.deleteRecord);

//----------------------Slots------------------------------------------//
router.get('/v1/slots', hasTempAccess(), slotController.index);
router.post('/v1/slot/getSlots', hasTempAccess(), slotController.getSlots);
router.post('/v1/slot/getAvailableSlots', isAuthenticated(), slotController.getAvailableSlots);
// router.get('/v1/slot/generateSlots', slotController.generateSlots);


//----------------------Specialities------------------------------------------//
router.get('/v1/specialities', hasTempAccess(), specialityController.index);
router.post('/v1/speciality/addNew', hasPermission("admin"), upload.single('file'), specialityController.addNew);
router.post('/v1/speciality/update', hasPermission("admin"), upload.single('file'), specialityController.update);
router.post('/v1/speciality/changeStatus', hasPermission("admin"), specialityController.changeStatus);
router.post('/v1/speciality/deleteRecord', hasPermission("admin"), specialityController.deleteRecord);


//----------------------Sliders------------------------------------------//
router.get('/v1/sliders', hasTempAccess(), sliderController.index);
router.post('/v1/slider/addNew', hasPermission("admin"), upload.single('file'), sliderController.addNew);
router.post('/v1/slider/addNewMulti', hasPermission("admin"), upload.array('file'), sliderController.addNewMulti);
router.post('/v1/slider/update', hasPermission("admin"), upload.array('file'), sliderController.update);
router.post('/v1/slider/changeStatus', hasPermission("admin"), sliderController.changeStatus);
router.post('/v1/slider/deleteRecord', hasPermission("admin"), sliderController.deleteRecord);

//----------------------Transactions------------------------------------------//
router.get('/v1/transactions', isAuthenticated(), transactionController.index);
router.post('/v1/transaction/confirmPayment', isAuthenticated(), transactionController.confirmPayment);
router.post('/v1/transaction/confirmPaymentCallback', transactionController.confirmPaymentCallback);
router.post('/v1/transaction/paymentWebhook', transactionController.paymentWebhook);

//----------------------Users------------------------------------------//
router.post('/v1/users', isAuthenticated(), userController.index);
router.get('/v1/user/profile', isAuthenticated(), userController.getProfile);
router.post('/v1/user/getUserProfile', isAuthenticated(), userController.getUserProfile);
router.post('/v1/user/updateProfile', isAuthenticated(), userController.updateProfile);
router.post('/v1/user/updateDeviceToken', isAuthenticated(), userController.updateDeviceToken);

//----------------------Medicine------------------------------------------//
router.get('/v1/medicines', isAuthenticated(), medicineController.index);
router.get('/v1/medicine/getMedicineTypes', isAuthenticated(), medicineController.getMedicineTypes);

//----------------------Prescription------------------------------------------//
router.post('/v1/prescriptions', isAuthenticated(), prescriptionController.index);
router.post('/v1/prescription/saveAsTemplate', isAuthenticated(), prescriptionController.saveAsTemplate);
router.post('/v1/prescription/submitPrescription', isAuthenticated(), prescriptionController.submitPrescription);
router.get('/v1/prescription/getSavedTemplate', isAuthenticated(), prescriptionController.getSavedTemplate);
router.post('/v1/prescription/deleteSavedTemplate', isAuthenticated(), prescriptionController.deleteSavedTemplate);

//----------------------Notification------------------------------------------//
router.post('/v1/notification', isAuthenticated(), notificationController.index);

//----------------------Render Pages------------------------------------------//
router.get('/v1/view', viewController.index);
router.get('/v1/view/renderPrescriptionPdf', viewController.renderPrescriptionPdf);

//----------------------Render Pages------------------------------------------//
router.get('/v1/cancellation_policy', termsandconditionController.renderCancellationPolicy);
router.get('/v1/refer_invite', termsandconditionController.renderReferInvite);
router.get('/v1/termsandcondition/generalTC', termsandconditionController.renderGeneralTC);
router.get('/v1/termsandcondition/practitionersTC', termsandconditionController.renderPractitionersTC);
router.get('/v1/termsandcondition/userTC', termsandconditionController.renderUserTC);

module.exports = router;
