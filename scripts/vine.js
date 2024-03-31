const vineCountryMap = {
	CA: {
		code: "CA",
		currency: "CAD",
		url: "https://www.amazon.ca",
		domain: "amazon.ca",
	},
	DE: {
		code: "DE",
		currency: "EUR",
		domain: "amazon.de",
		url: "https://www.amazon.de",
	},
	ES: {
		code: "ES",
		currency: "EUR",
		url: "https://www.amazon.es",
		domain: "amazon.es",
	},
	FR: {
		code: "FR",
		currency: "EUR",
		url: "https://www.amazon.fr",
		domain: "amazon.fr",
	},
	GB: {
		code: "GB",
		currency: "GBP",
		url: "https://www.amazon.co.uk",
		domain: "amazon.co.uk",
	},
	JP: {
		code: "JP",
		currency: "JPY",
		url: "https://www.amazon.co.jp",
		domain: "amazon.co.jp",
	},
	US: {
		code: "US",
		currency: "USD",
		url: "https://www.amazon.com",
		domain: "amazon.com",
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

	formatDate(dateString) {
		return new Date(dateString).toLocaleString(this.language);
	}

	formatTimeAgo(dateString) {
		return Math.floor((new Date() - new Date(dateString)) / (1000 * 60)) + "m";
	}
}
