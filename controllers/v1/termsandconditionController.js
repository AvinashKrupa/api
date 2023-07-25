const path = require('path');

const renderGeneralTC = async (req, res) => {
    res.render(path.resolve(__dirname + '/../../views/generalTC.ejs'));
}

const renderPractitionersTC = async (req, res) => {
    res.render(path.resolve(__dirname + '/../../views/practitionersTC.ejs'));
}

const renderUserTC = async (req, res) => {
    res.render(path.resolve(__dirname + '/../../views/userTC.ejs'));
}
const renderCancellationPolicy = async (req, res) => {
    res.sendFile(path.resolve(__dirname + '/../../views/cancellation_policy.html'))
}

const renderReferInvite = async (req, res) => {
    res.sendFile(path.resolve(__dirname + '/../../views/refer_invite.html'))
}
module.exports = {
    renderGeneralTC,
    renderPractitionersTC,
    renderUserTC,
    renderCancellationPolicy,
    renderReferInvite
}
