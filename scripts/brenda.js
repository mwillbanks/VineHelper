class Brenda {
	constructor({ domain, guid, toast }) {
		this.DEFAULT_RATE_LIMIT_SECS = 10;
		this.RESPONSE_STATUS_TMPL = {
			200: "{asin} has been successfully announced to Brenda.",
			401: "API Token invalid, please go in the extension settings to correct it.",
			422: "Unprocessable entity. The request was malformed and rejected.",
			429: "Hit rate limit, backing off, will retry.",
			default: "The announce has failed for an unknown reason.",
		};
		this.MAX_QUEUE_LENGTH = 5;
		this.URL = "https://api.llamastories.com/brenda/product";

		this.isProcessing = false;
		this.lastProcessTime = 0;
		this.queueTimer = null;
		this.rateLimitSecs = this.DEFAULT_RATE_LIMIT_SECS;
		this.guid = guid;
		this.queue = [];
		this.domain = domain;
		this.toast = toast;
	}

	async announce(asin, etv, queue) {
		if (this.queue.length >= this.MAX_QUEUE_LENGTH) {
			this.toast.show({
				title: "Brenda Announcement",
				message: "The queue is full, not everything should be shared. Please be selective.",
			});
			return;
		}

		this.queue.push({ asin, etv, queue });

		if (this.queueTimer !== null || this.isProcessing) {
			return;
		}

		const queueTimeout =
			this.lastProcessTime && this.lastProcessTime + this.rateLimitSecs * 1000 > Date.now()
				? Date.now() - this.lastProcessTime + this.rateLimitSecs * 1000
				: 0;
		this.queueTimer = setTimeout(this.process.bind(this), queueTimeout);
	}

	async process() {
		if (this.queue.length == 0) {
			this.queueTimer = null;
			return;
		}
		this.isProcessing = true;

		const item = this.queue.shift();
		let message = this.RESPONSE_STATUS_TMPL.default;
		try {
			const { status } = await fetch(this.URL, {
				method: "PUT",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					version: 1,
					token: this.guid,
					domain: this.domain,
					tab: item.queue,
					asin: item.asin,
					etv: item.etv,
				}),
			});

			if (status === 429) {
				this.queue.unshift(item);
				this.rateLimitCount++;
			} else {
				this.rateLimitCount = this.rateLimitCount > 0 ? this.rateLimitCount - 1 : 0;
			}
			this.rateLimitSecs = (this.rateLimitCount + 1) * this.DEFAULT_RATE_LIMIT_SECS;
			message = this.RESPONSE_STATUS_TMPL[status] || this.RESPONSE_STATUS_TMPL.default;
		} catch (error) {
			console.error(error);
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
