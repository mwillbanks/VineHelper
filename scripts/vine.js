const vineCountryMap = {
	CA: {
		url: "https://www.amazon.ca",
		currency: "CAD",
		code: "CA",
	},
	EU: {
		url: "https://www.amazon.de",
		currency: "EUR",
		code: "DE",
	},
	FR: {
		url: "https://www.amazon.fr",
		currency: "EUR",
		code: "FR",
	},
	GB: {
		url: "https://www.amazon.co.uk",
		currency: "GBP",
		code: "GB",
	},
	JP: {
		url: "https://www.amazon.co.jp",
		currency: "JPY",
		code: "JP",
	},
	US: {
		url: "https://www.amazon.com",
		currency: "USD",
		code: "US",
	},
};

class Vine {
	constructor() {
		this.language = window.navigator.language;
		this.country = this.language.split("-")[1] || "US";
		for (const key in vineCountryMap[this.country]) {
			this[key] = vineCountryMap[this.country][key];
		}
		this.currencyFormatter = new Intl.NumberFormat(this.language, {
			style: "currency",
			currency: this.currency,
		});
	}

	formatCurrency(amount) {
		return this.currencyFormatter.format(amount);
	}

	formatTimeAgo(dateString) {
		return Math.floor((new Date() - new Date(dateString)) / (1000 * 60)) + "m";
	}

	formatDate(dateString) {
		return new Date(dateString).toLocaleString(this.language);
	}
}
