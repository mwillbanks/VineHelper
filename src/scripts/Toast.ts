import { Logger } from "./Logger";
import { Toast as BSToast } from "bootstrap";

/**
 * A toast message.
 */
export class Toast {
	/**
	 * Whether to animate the toast message.
	 */
	ANIMATION: boolean;

	/**
	 * Whether to auto hide the toast message.
	 */
	AUTO_HIDE: boolean;

	/**
	 * The delay before hiding the toast message.
	 */
	DELAY: number;

	/**
	 * The container to show the toast message in.
	 */
	container: HTMLElement | null;

	/**
	 * The logger instance.
	 */
	logger: Logger;

	/**
	 * The template for the toast message.
	 */
	template: any;

	/**
	 * @param logger - The logger instance.
	 */
	constructor({ logger }: { logger: Logger }) {
		this.ANIMATION = true;
		this.AUTO_HIDE = true;
		this.DELAY = 2000;

		this.container = document.getElementById("toast-container");
		this.logger = logger.scope("toast");
		this.template = document.querySelector<HTMLTemplateElement>("#templateToastMessage")!.content;
	}

	/**
	 * Show a toast message.
	 * 
	 * @param title - The title of the toast message.
	 * @param message - The message of the toast message.
	 */
	show({ title, message } : { title: string, message: string }) {
		const log = this.logger.scope("show");
		log.debug("params", { title, message });

		const toast = this.template.cloneNode(true);
		const toastContainer = toast.querySelector(".toast");
		toastContainer.dataset.bsDelay = this.DELAY;
		toastContainer.dataset.bsAutohide = this.AUTO_HIDE;
		toastContainer.dataset.bsAnimation = this.ANIMATION;

		const toastHeader = toastContainer.querySelector(".toast-header");

		toastHeader.querySelector(".me-auto").textContent = title;
		toastContainer.querySelector(".toast-body").textContent = message;
		this.container!.appendChild(toast);

		try {
			log.debug("showing toast");
			BSToast.getOrCreateInstance(toastContainer).show();
		} catch (error) {
			log.error("error", error);
		}
	}
}
