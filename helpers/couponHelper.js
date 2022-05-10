import Coupon from "../db/models/coupon";

export const getFinalAmount = async (fee, code, patientId) => {
    let coupon = await Coupon.findOne({
        code: code,
    })
    let discount = 0

    var final_amount = fee
    if (!coupon) {
        return Promise.reject("Invalid coupon code.")
    } else {
        switch (coupon.status) {
            case 'active':
            {
                if(coupon.coupon_type ==='clinic') {
                    discount = (coupon.discount_pct * fee / 100)
                    final_amount = fee - discount
                    return Promise.resolve({final_amount, coupon, discount})
                } 
                if (coupon.usages && coupon.usages.length > 0) {
                    let existing = coupon.usages.find(usage => {
                        return usage.patient.toString() == patientId.toString()
                    })
                    if (existing) {
                        return Promise.reject("Code already used.")
                    }
                }
                discount = (coupon.discount_pct * fee / 100)
                final_amount = fee - discount ;
                return Promise.resolve({final_amount, coupon, discount})   
            }
            case "expired":
                return Promise.reject("Coupon expired.")
            default:
                return Promise.reject("Invalid coupon code.")
        }
    }

}
export const useCoupon = async (coupon_id, appointment_id, patient_id) => {

    let coupon = await Coupon.findOne({_id: coupon_id})
    coupon.usages.push({
        patient: patient_id,
        appointment: appointment_id,
        date: new Date()
    })

    if (coupon.usages && coupon.usages.length >= coupon.max_usages) {
        coupon.status = "used"
    }
    return coupon.save()
}
