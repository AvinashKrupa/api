function HandleError(message, code) {
	this.code = code;
	this.message = message;
}

HandleError.prototype = Error.prototype;

module.exports = {
	HandleError,
};
