import { TypeProductQueue } from "./ListManager";

/**
 * Vine Queue Enum
 * @enum {string}
 * @readonly
 * @property {string} encore - The encore queue.
 * @property {string} last_chance - The last chance queue.
 * @property {string} potluck - The potluck queue.
 */
export enum TypeVineQueue {
	encore = "encore",
	last_chance = "last_chance",
	potluck = "potluck",
};

/**
 * Vine Queue to Product Queue Map
 * @type {Object.<TypeVineQueue, TypeProductQueue>}
 */
export const vineQueueToProductQueue: {
	[key in TypeVineQueue]: TypeProductQueue;
} = {
	[TypeVineQueue.encore]: TypeProductQueue.AI,
	[TypeVineQueue.last_chance]: TypeProductQueue.AFA,
	[TypeVineQueue.potluck]: TypeProductQueue.RFY,
};

/**
 * Vine Country Map
 * @type {Object.<string, { code: string, currency: string, url: string, domain: string }>}
 */
const vineCountryMap: {
	[country: string]: {
		code: string;
		currency: string;
		url: string;
		domain: string;
	};
} = {
	CA: {
		code: "CA",
		currency: "CAD",
		domain: "amazon.ca",
		url: "https://www.amazon.ca",
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
		domain: "amazon.es",
		url: "https://www.amazon.es",
	},
	FR: {
		code: "FR",
		currency: "EUR",
		domain: "amazon.fr",
		url: "https://www.amazon.fr",
	},
	GB: {
		code: "GB",
		currency: "GBP",
		domain: "amazon.co.uk",
		url: "https://www.amazon.co.uk",
	},
	JP: {
		code: "JP",
		currency: "JPY",
		domain: "amazon.co.jp",
		url: "https://www.amazon.co.jp",
	},
	US: {
		code: "US",
		currency: "USD",
		domain: "amazon.com",
		url: "https://www.amazon.com",
	},
};

/**
 * Vine Class
 */
export class Vine {
	/**
	 * The country code.
	 */
	code: string;

	/**
	 * The country.
	 */
	country: string;

	/**
	 * The currency.
	 */
	currency: string;

	/**
	 * The currency formatter.
	 */
	currencyFormatter: Intl.NumberFormat;

	/**
	 * The domain.
	 */
	domain: string;

	/**
	 * The language.
	 */
	language: string;

	/**
	 * The url.
	 */
	url: string;

	/**
	 * The queue.
	 */
	queue: string;

	/**
	 * @constructor
	 */
	constructor() {
		this.language = window.navigator.language;
		this.country = (this.language.split("-")?.[1] || "US").toUpperCase();
		if (!vineCountryMap[this.country]) {
			this.country = "US";
		}

		this.code = vineCountryMap[this.country].code;
		this.currency = vineCountryMap[this.country].currency;
		this.currencyFormatter = new Intl.NumberFormat(this.language, {
			style: "currency",
			currency: this.currency,
		});
		this.domain = vineCountryMap[this.country].domain;
		this.url = vineCountryMap[this.country].url;
		this.queue = this.url.split(".").pop() as string;
	}

	/**
	 * Format a currency amount.
	 * 
	 * @param {number|string} amount - The amount to format.
	 * @returns {string} The formatted currency amount.
	 */
	formatCurrency(amount: number | string): string {
		if (typeof amount === "string") {
			amount = parseFloat(amount);
		}

		return this.currencyFormatter.format(amount);
	}

	/**
	 * Format a date string.
	 * 
	 * @param {string|number} dateString - The date string to format.
	 * @returns {string} The formatted date string.
	 */
	formatDate(dateString: string | number): string {
		return new Date(dateString).toLocaleString(this.language);
	}

	/**
	 * Format a time ago string.
	 * 
	 * @param {string|number} dateString - The date string to format.
	 * @returns {string} The formatted time ago string.
	 */
	formatTimeAgo(dateString: string | number): string {
		return Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60)) + "m";
	}
}
