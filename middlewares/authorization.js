import {isAuthenticated} from "./authentication";
import {errorResponse} from "../helpers/responseHelper";
import {translate} from "../helpers/multilingual";

// const AccessControl = require('role-acl');

const compose = require('compose-middleware').compose;
// const ac = new AccessControl();
/**
 * This function checks if a particular role has a permission to access a resource or not
 * @param permission
 * @param resource
 */
export const hasPermission = (permission, resource) => {
    return compose([
        isAuthenticated(),
        async function (req, res, next) {
            const translator = translate(req.headers.lang);
            if (permission === "admin"
                && res.locals.user.role_id
                && res.locals.user.role_id.toString() === "612362ab40eef4f51b11e4d9")
                next()
            else if (!permission || permission === "")
                next()
            else {
                errorResponse(translator.__("not_authorized"), res, 403)
            }
            // const userSg = await UserSG.findOne({
            //     where: {user_uuid: res.locals.user.user_uuid},
            //     include: [{
            //         model: SecurityRole,
            //         as: 'role_code_security_role',
            //         attributes: ['role_acl'],
            //         raw: true
            //     }]
            // });
            // let grants = userSg.role_code_security_role.role_acl.grants
            // grants.forEach(grant => {
            //     grant.role = userSg.role_code
            // })
            // ac.setGrants(grants);
            // const permStatus = ac.can(userSg.role_code).execute(permission).sync().on(resource);
            // if (permStatus.granted) {
            //     next()
            // } else {
            //     const translator = translate(req.headers.lang);
            //     errorResponse(translator.__("not_authorized"), res, 403)
            // }

        }
    ]);
}
