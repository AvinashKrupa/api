const path = require('path');

const renderGeneralTC = async (req, res) => {
    res.render('generalTC.ejs');
}

const renderPractitionersTC = async (req, res) => {
    res.render('practitionersTC.ejs');
}

const renderUserTC = async (req, res) => {
    res.render('userTC.ejs');
}
const renderCancellationPolicy = async (req, res) => {
    res.sendFile(path.resolve('views/cancellation_policy.html'))
}

const renderReferInvite = async (req, res) => {
    res.sendFile(path.resolve('views/refer_invite.html'))
}
module.exports = {
    renderGeneralTC,
    renderPractitionersTC,
    renderUserTC,
    renderCancellationPolicy,
    renderReferInvite
}
