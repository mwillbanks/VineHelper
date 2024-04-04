import { Logger } from "./Logger";
import { Toast } from "./Toast";

type BrendaQueueItem = {
	asin: string;
	etv: string;
	queue: string;
};

export class Brenda {
	DEFAULT_RATE_LIMIT_SECS: number = 10;
	RESPONSE_STATUS_TMPL: { [status: string]: string } = {
		"200": "{asin} has been successfully announced to Brenda.",
		"401": "API Token invalid, please go in the extension settings to correct it.",
		"422": "Unprocessable entity. The request was malformed and rejected.",
		"429": "Hit rate limit, backing off, will retry.",
		default: "The announce has failed for an unknown reason.",
	};
	MAX_QUEUE_LENGTH: number = 5;
	URL: string = "https://api.llamastories.com/brenda/product";
	isProcessing: boolean = false;
	lastProcessTime: number = 0;
	queueTimer: null | NodeJS.Timeout = null;
	rateLimitSecs: number = this.DEFAULT_RATE_LIMIT_SECS;
	guid: string;
	queue: BrendaQueueItem[] = [];
	domain: string;
	logger: Logger;
	toast: Toast;
	rateLimitCount: number = 0;

	constructor({ domain, guid, logger, toast }: { domain: string, guid: string, logger: Logger, toast: Toast }) {
		this.guid = guid;
		this.domain = domain;
		this.logger = logger.scope("brenda");
		this.toast = toast;
	}

	async announce(asin: string, etv: string, queue: string) {
		const log = this.logger.scope("announce");
		log.debug("params", { asin, etv, queue });
		if (this.queue.length >= this.MAX_QUEUE_LENGTH) {
			log.error("queue is full");
			this.toast.show({
				title: "Brenda Announcement",
				message: "The queue is full, not everything should be shared. Please be selective.",
			});
			return;
		}

		this.queue.push({ asin, etv, queue });

		if (this.queueTimer !== null || this.isProcessing) {
			log.debug("queue is already being processed");
			return;
		}

		const queueTimeout =
			this.lastProcessTime && this.lastProcessTime + this.rateLimitSecs * 1000 > Date.now()
				? Date.now() - this.lastProcessTime + this.rateLimitSecs * 1000
				: 0;
		log.debug("queueTimeout", queueTimeout);
		this.queueTimer = setTimeout(this.process.bind(this), queueTimeout);
	}

	async process() {
		const log = this.logger.scope("process");
		if (this.queue.length == 0) {
			log.debug("queue is empty");
			this.queueTimer = null;
			return;
		}
		this.isProcessing = true;

		const item = this.queue.shift() as BrendaQueueItem;
		let message = this.RESPONSE_STATUS_TMPL.default;
		try {
			const params = {
				method: "PUT",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					version: String(1),
					token: this.guid,
					domain: this.domain,
					tab: item.queue,
					asin: item.asin,
					etv: item.etv,
				}),
			};
			log.debug("request", { url: this.URL, params });
			const { status } = await fetch(this.URL, params);
			log.debug("response", { status });

			if (status === 429) {
				this.queue.unshift(item);
				this.rateLimitCount++;
				log.debug(`rate limited, new rate limit count: ${this.rateLimitCount}`);
			} else {
				this.rateLimitCount = this.rateLimitCount > 0 ? this.rateLimitCount - 1 : 0;
				log.debug(`success, new rate limit count: ${this.rateLimitCount}`);
			}
			this.rateLimitSecs = (this.rateLimitCount + 1) * this.DEFAULT_RATE_LIMIT_SECS;
			message = this.RESPONSE_STATUS_TMPL?.[String(status)] || this.RESPONSE_STATUS_TMPL.default;
		} catch (error) {
			log.error(error);
			this.queue.unshift(item);
		}

		this.queueTimer = setTimeout(this.process.bind(this), this.rateLimitSecs * 1000);
		this.isProcessing = false;
		this.lastProcessTime = Date.now();

		// Replace placeholders in the message
		message = message.replace("{asin}", item.asin);
		this.toast.show({ title: "Brenda Announcement", message });
	}
}
