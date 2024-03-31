class Toast {
	constructor() {
		this.ANIMATION = true;
		this.AUTO_HIDE = true;
		this.DELAY = 2000;

		this.container = document.getElementById("toast-container");
		this.template = document.getElementById("templateToastMessage").content;
	}

	show({ title, message }) {
		const toast = this.template.cloneNode(true);
		const toastContainer = toast.querySelector(".toast");
		toastContainer.dataset.bsDelay = this.DELAY;
		toastContainer.dataset.bsAutohide = this.AUTO_HIDE;
		toastContainer.dataset.bsAnimation = this.ANIMATION;

		const toastHeader = toastContainer.querySelector(".toast-header");

		toastHeader.querySelector(".me-auto").textContent = title;
		toastContainer.querySelector(".toast-body").textContent = message;
		this.container.appendChild(toast);

		window.bootstrap.Toast.getOrCreateInstance(toastContainer).show();
	}
}
