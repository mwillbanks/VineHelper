import { Logger } from "./Logger";
import { Toast as BSToast } from "bootstrap";
import { Util } from "./Util";

/**
 * A toast message.
 */
export class Toast {
	/**
	 * Whether to animate the toast message.
	 */
	protected ANIMATION: boolean;

	/**
	 * Whether to auto hide the toast message.
	 */
	protected AUTO_HIDE: boolean;

	/**
	 * The delay before hiding the toast message.
	 */
	protected DELAY: number;

	/**
	 * The container to show the toast message in.
	 */
	protected container: HTMLElement | null;

	/**
	 * The template for the toast message.
	 */
	protected template: any;

	protected logger: Logger;
	protected util: Util;

	/**
	 * Creates an instance of Toast.
	 * 
	 * The toast message is shown in a container at the bottom right of the screen.
	 * 
	 * @param logger - The logger object.
	 * @param shadowRoot - The shadow root element.
	 */
	constructor({ logger, shadowRoot }: { logger: Logger, shadowRoot?: ShadowRoot }) {
		this.ANIMATION = true;
		this.AUTO_HIDE = true;
		this.DELAY = 2000;

		this.logger = logger.scope("toast");
		this.util = new Util({ logger });

		const target = shadowRoot ?? document;
		const targetBody = shadowRoot ?? document.body;

		this.container = target.getElementById("toast-container");
		if (!this.container) {
			this.container = this.util.createElement({ tag: "div", attributes: { id: "toast-container", class: 'position-fixed bottom-0 end-0 p-1' } });
			targetBody.appendChild(this.container);
		}

		this.template = target.querySelector<HTMLTemplateElement>("#templateToastMessage")?.content;
		if (!this.template) {
			const template = this.util.createElement({ tag: "template", attributes: { id: "templateToastMessage" }, children: [
				this.util.createElement({ tag: "div", attributes: { class: "toast", role: "alert", "aria-live": "assertive", "aria-atomic": "true" }, children: [
					this.util.createElement({ tag: "div", attributes: { class: "toast-header" }, children: [
						this.util.createElement({ tag: "strong", attributes: { class: "me-auto" } }),
						this.util.createElement({ tag: "small", attributes: { class: "text-body-secondary" } }),
						this.util.createElement({ tag: "button", attributes: { type: "button", class: "btn-close", "data-bs-dismiss": "toast", "aria-label": "Close" } }),
					]}),
					this.util.createElement({ tag: "div", attributes: { class: "toast-body" } }),
				]}),
			] }) as HTMLTemplateElement;
			this.template = template;
		}
	}

	/**
	 * Show a toast message.
	 * 
	 * @param title - The title of the toast message.
	 * @param message - The message of the toast message.
	 */
	show({ title, message }: { title: string, message: string }) {
		const log = this.logger.scope("show");
		log.debug("params", { title, message });

		const toast = this.template.cloneNode(true);
		const toastContainer = toast.querySelector(".toast");
		toastContainer.dataset.bsDelay = this.DELAY;
		toastContainer.dataset.bsAutohide = this.AUTO_HIDE;
		toastContainer.dataset.bsAnimation = this.ANIMATION;
		toastContainer.addEventListener("hidden.bs.toast", () => {
			toast.remove();
		});

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
