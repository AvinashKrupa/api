let i18n_module = require("i18n-nodejs");
const path = require('path')

let translate = (lang) => {
	let config = {
		lang: lang ? lang : "en",
		langFile: path.join(__dirname, 'locale.json'),
	};

	return new i18n_module(config.lang, config.langFile);
};

module.exports = {
	translate,
};
