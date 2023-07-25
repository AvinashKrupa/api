import {createJwtToken, verifyJWT} from "./hashHelper";
import * as config from "../config/config";

import Session from "../db/models/session";
import User from "../db/models/user";
import Patient from "../db/models/patient";
import Doctor from "../db/models/doctor";

function getAccessToken(user, sessionId, selected_profile) {
    return createJwtToken(
        {
            user_id: user._id,
            sid: sessionId,
            first_name: user.first_name,
            selected_profile: selected_profile
        },
        config.accessTokenExpiry || "1h"
    );
}

function getRefreshToken(sessionId, user, selected_profile) {
    return createJwtToken(
        {
            user_id: user._id,
            sid: sessionId,
            selected_profile: selected_profile
        },
        config.refreshTokenExpiry || "7d"
    );
}

function getTempAccessToken(mobile_number, type) {
    return createJwtToken(
        {
            mobile_number: mobile_number,
            type: type
        },
        config.accessTokenExpiry || "1h"
    );
}

async function getMeetingAccessToken(appointment, currentUser) {
    let user, token
    switch (currentUser.selected_profile) {
        case config.constants.USER_TYPE_PATIENT:
            user = await Patient.findOne({_id: currentUser.selected_profile_id}).populate("user_id")
            token = user.meet_token
            break
        case config.constants.USER_TYPE_DOCTOR:
            user = await Doctor.findOne({_id: currentUser.selected_profile_id}).populate("user_id")
            token = user.meet_token
    }
    try {
        let decoded = verifyJWT(token, process.env.MEET_SECRET)
        if (!decoded || decoded.room != appointment._id) {
            token = null
        }
    } catch (e) {
        token = null
    }
    if (!token) {
        token = createJwtToken(
            {
                "context": {
                    "user": {
                        "avatar": user.user_id.dp,
                        "name": user.user_id.first_name,
                        "email": user.user_id.email
                    }
                },
                "moderator": false,
                "aud": process.env.MEET_APP_ID,
                "iss": process.env.MEET_APP_ID,
                "sub": process.env.MEET_DOMAIN,
                "room": appointment._id,
            },
            "20m",
            process.env.MEET_SECRET
        );
        switch (currentUser.selected_profile) {
            case config.constants.USER_TYPE_PATIENT:
                await Patient.findOneAndUpdate({_id: currentUser.selected_profile_id}, {meet_token: token})

                break
            case config.constants.USER_TYPE_DOCTOR:
                await Doctor.findOneAndUpdate({_id: currentUser.selected_profile_id}, {meet_token: token})
                break
        }
    }
    return token

}

async function createSession(user, selected_profile) {
    let session = new Session({
        user_id: user._id,
    })
    await session.save()
    const accessToken = getAccessToken(user, session._id, selected_profile)
    session.refresh_token = getRefreshToken(session._id, user, selected_profile)
    session.access_token = accessToken
    session = await session.save()
    return {session: session, user: user}
}
async function endSession(userId){
    return Promise.all([
        Session.deleteMany({user_id: userId}),
        User.findOneAndUpdate({
            _id: userId,
        }, {device_token: ''})])
}
async function endSessionsAndCreateNew(user, type) {
    await endSession(user._id)
    return createSession(user, type)
}
async function getSessionWithNewAccessToken(user, token) {
    let session = await Session.findOne({
        user_id: user._id,
        refresh_token: token
    })
    if (session) {
        session.access_token = getAccessToken(user, session._id, user.selected_profile)
        await session.save()
        return Promise.resolve({refresh_token: token, access_token: access_token})
    }

}
module.exports = {
    createSession,
    endSession,
    endSessionsAndCreateNew,
    getSessionWithNewAccessToken,
    getTempAccessToken,
    getMeetingAccessToken
}
