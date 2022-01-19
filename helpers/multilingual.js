let i18n_module = require("i18n-nodejs");

let translate = (lang) => {
	let config = {
		lang: lang ? lang : "en",
		langFile: "../../helpers/locale.json",
	};

	return new i18n_module(config.lang, config.langFile);
};

module.exports = {
	translate,
};
