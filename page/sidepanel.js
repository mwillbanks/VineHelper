/* eslint-disable no-console */
const VH_SIDE_PANEL_SETTINGS_DEFAULT = {
	feed: {
		title: "Feed Configuration",
		isConfigurable: true,
		options: {
			expire: {
				label: "Expire Items",
				type: "number",
				value: 30,
				units: "min",
			},
			perRow: {
				label: "Per Row",
				type: "number",
				value: 4,
				units: "items",
			},
		},
	},
	interface: {
		title: "Interface Configuration",
		isConfigurable: true,
		options: {
			theme: {
				label: "Theme",
				type: "select",
				value: "light",
				options: ["light", "dark"],
			},
		},
	},
	tabs: {},
};

(async () => {
	const util = new Util();
	const toast = new Toast();
	const vine = new Vine();

	const [VH_SIDE_PANEL_SETTINGS, VH_SETTINGS, VH_HIDDEN_ITEMS, VH_NOTIFICATIONS, VH_PINNED] =
		await util.getLocalStorage(
			["vhSidePanel", "settings", "hiddenItems", "notifications", "pinned"],
			[VH_SIDE_PANEL_SETTINGS_DEFAULT, {}, {}, {}, {}]
		);

	const brenda = new Brenda({
		domain: vine.domain,
		guid: VH_SETTINGS?.discord?.guid,
		toast,
	});

	const VH_SEEN_PRODUCTS = {};
	const VH_TAB_PRODUCTS = {};

	/** restore pinned to seen products */
	for (const asin in VH_PINNED) {
		VH_SEEN_PRODUCTS[asin] = VH_PINNED[asin];
	}

	chrome.storage.onChanged.addListener((changes, namespace) => {
		for (let [key, { newValue }] of Object.entries(changes)) {
			if (key === "hiddenItems") {
				Object.entries(newValue).forEach(([asin, date]) => {
					if (date) {
						VH_HIDDEN_ITEMS[asin] = date;
					} else {
						delete VH_HIDDEN_ITEMS[asin];
					}
				});

				for (const asin in VH_SEEN_PRODUCTS) {
					if (VH_HIDDEN_ITEMS[asin]) {
						delete VH_SEEN_PRODUCTS[asin];
					}
				}
			}
		}
	});

	/** Garbage Collection */
	setInterval(() => {
		let expiration = Date.now() - 1000 * 60 * VH_SIDE_PANEL_SETTINGS.feed.options.expire.value;
		for (const asin in VH_SEEN_PRODUCTS) {
			if (VH_PINNED[asin]) {
				continue;
			}
			if (VH_SEEN_PRODUCTS[asin].date < expiration) {
				document.getElementById(`product-${asin}`)?.remove();
				delete VH_SEEN_PRODUCTS[asin];
			}
		}

		expiration = Date.now() - 1000 * 60 * 60 * 24 * 30;
		for (const asin in VH_HIDDEN_ITEMS) {
			if (VH_HIDDEN_ITEMS[asin] < expiration) {
				delete VH_HIDDEN_ITEMS[asin];
			}
		}

		chrome.storage.local.set({ hiddenItems: VH_HIDDEN_ITEMS, notifications: VH_NOTIFICATIONS, pinned: VH_PINNED });
	}, 1000 * 60);

	/** Notification Event Handlers */
	chrome.notifications.onClosed.addListener((notificationId, buttonIndex) => {
		delete VH_NOTIFICATIONS[notificationId];
	});
	chrome.notifications.onClicked.addListener((notificationId, buttonIndex) => {
		const asin = VH_NOTIFICATIONS[notificationId];
		delete VH_NOTIFICATIONS[notificationId];
		window.open(`${vine.url}/vine/vine-items?search=${VH_SEEN_PRODUCTS[asin].search}`, "_blank");
	});
	chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
		const asin = VH_NOTIFICATIONS[notificationId];
		delete VH_NOTIFICATIONS[notificationId];
		if (buttonIndex === 0) {
			window.open(`${vine.url}/vine/vine-items?search=${VH_SEEN_PRODUCTS[asin].search}`, "_blank");
		}
	});

	const loading = document.getElementById("last-updated-loader");

	/** Product Event Handlers */
	const productActionHandler = (event) => {
		const action = event.target.dataset.action;
		const asin = event.target.dataset.asin;

		switch (action) {
			case "search":
				window.open(`${vine.url}/vine/vine-items?search=${event.target.dataset.search}`, "_blank");
				break;
			case "view":
				window.open(`${vine.url}/dp/${asin}`, "_blank");
				break;
			case "announce":
				event.target.remove();
				VH_SEEN_PRODUCTS[asin].announced = true;
				brenda.announce(asin, VH_SEEN_PRODUCTS[asin].etv, VH_SEEN_PRODUCTS[asin].queue);
				break;
			case "pin":
				VH_PINNED[asin] = VH_SEEN_PRODUCTS[asin];
				renderProducts(VH_SEEN_PRODUCTS, searchText);
				break;
			case "unpin":
				delete VH_PINNED?.[asin];
				renderProducts(VH_SEEN_PRODUCTS, searchText);
				break;
			case "hide":
				event.target.closest(".card").remove();
				delete VH_PINNED?.[asin];
				delete VH_SEEN_PRODUCTS?.[asin];
				VH_HIDDEN_ITEMS[asin] = Date.now();
				renderProducts(VH_SEEN_PRODUCTS, searchText);
				break;
		}
	};

	/** Tab Rendering */
	const tabItemTemplate = document.getElementById("templateTabItem").content;
	const tabContentTemplate = document.getElementById("templateTabContent").content;
	const renderTabs = (tabDefs) => {
		tabDefs = Object.entries(tabDefs || {});
		tabDefs.unshift([
			"all",
			{
				isRegex: false,
				isZeroEtv: false,
				name: "All",
				search: null, // special case
			},
		]);

		const tabNavContainer = document.getElementById("vh-tabs-nav");
		const tabContentContainer = document.getElementById("vh-tabs-content");
		tabNavContainer.innerHTML = "";
		tabContentContainer.innerHTML = "";

		let tabSelected = true;
		for (let i = 0; i < tabDefs.length; i++) {
			const [id, attr] = tabDefs[i];

			const tabNav = document.importNode(tabItemTemplate, true);
			const tabContent = document.importNode(tabContentTemplate, true);

			const link = tabNav.querySelector(".nav-link");
			link.id = `tab-${id}-nav`;
			link.href = `#tab-${id}`;
			link.dataset.bsTarget = `#tab-${id}-content`;
			link.dataset.id = id;
			link.querySelector(".nav-title").textContent = attr.name;

			const content = tabContent.querySelector(".tab-pane");
			content.tabindex = i;
			content.id = `tab-${id}-content`;

			tabContent
				.querySelector(".vh-products")
				.classList.add(`row-cols-${VH_SIDE_PANEL_SETTINGS.feed.options.perRow.value}`);

			if (tabSelected) {
				link.classList.add("active");
				content.classList.add("show", "active");
			}

			tabNavContainer.appendChild(tabNav);
			tabContentContainer.appendChild(tabContent);
			tabSelected = false;
		}
	};

	/** Product Rendering */
	const renderProducts = (products, searchText) => {
		const template = document.getElementById("productTemplate").content;
		const fragment = document.createDocumentFragment();
		const tabDefs = Object.entries(VH_SIDE_PANEL_SETTINGS?.tabs || {});
		tabDefs.unshift([
			"all",
			{
				isRegex: false,
				isZeroEtv: false,
				name: "All",
				search: null, // special case
			},
		]);

		let searchProducts = Object.values(products);
		if (searchText) {
			searchProducts = searchProducts.filter((product) => product.title.toLowerCase().includes(searchText));
		}
		searchProducts = searchProducts.sort((a, b) => {
			if (!VH_PINNED[a.asin] && VH_PINNED[b.asin]) {
				return 1;
			} else if (VH_PINNED[a.asin] && !VH_PINNED[b.asin]) {
				return -1;
			}
			return b.date - a.date;
		});

		for (let i = 0; i < tabDefs.length; i++) {
			const [tabId, tabAttr] = tabDefs[i];
			const container = document.querySelector(`#tab-${tabId}-content .vh-products`);

			let searchRegEx;
			if (tabAttr.search && tabAttr.isRegex) {
				try {
					searchRegEx = new RegExp(tabAttr.search);
				} catch (e) {
					console.log("Invalid regex", tabAttr.search, e);
					continue;
				}
			}

			const filteredProducts = searchProducts.filter((product) => {
				const productTitleLc = product.title.toLowerCase();

				if (tabAttr.isZeroEtv && product.etv !== "0.00") {
					return false;
				}

				if (searchRegEx) {
					return searchRegEx.test(productTitleLc);
				}
				if (tabAttr.search) {
					return productTitleLc.includes(tabAttr.search);
				}
				return true;
			});

			let productCount = 0;
			filteredProducts.forEach((product) => {
				if (VH_HIDDEN_ITEMS[product.asin]) {
					return;
				}

				const productClone = document.importNode(template, true);
				const card = productClone.querySelector(".card");
				card.id = `${tabId}-${product.asin}`;

				const header = card.querySelector(".card-header");
				header.textContent = String(product.title).substring(0, 25);
				header.title = product.title;
				header.dataset.bsTitle = product.title;
				header.dataset.bsPlacement = "top";

				const img = card.querySelector(".card-img-top");
				img.src = product.img_url;
				img.alt = product.title;

				const footer = card.querySelector(".card-footer");
				footer.querySelector(".time-ago").textContent = vine.formatTimeAgo(product.date);
				if (product.etv !== null) {
					if (product.etv === "0.00") {
						card.classList.add("zero-etv");
					}

					const etvContainer = footer.querySelector(".etv");
					etvContainer.classList.toggle("d-none");
					etvContainer.querySelector(".etv-value").textContent = vine.formatCurrency(product.etv);
				}
				const actions = footer.querySelectorAll(".btn-group-sm i");
				actions[0].dataset.action = "search";
				actions[0].dataset.asin = product.asin;
				actions[0].dataset.search = encodeURIComponent(product.search);
				actions[1].dataset.action = "pin";
				actions[1].dataset.asin = product.asin;
				if (VH_PINNED[product.asin]) {
					actions[1].classList.add("d-none");
				}
				actions[2].dataset.action = "unpin";
				actions[2].dataset.asin = product.asin;
				if (!VH_PINNED[product.asin]) {
					actions[2].classList.add("d-none");
				}
				actions[3].dataset.action = "hide";
				actions[3].dataset.asin = product.asin;
				actions[4].dataset.action = "view";
				actions[4].dataset.asin = product.asin;
				actions[5].dataset.action = "announce";
				actions[5].dataset.asin = product.asin;
				if (product.etv === null || product.announced) {
					actions[5].classList.add("d-none");
				}
				actions.forEach((action) => action.addEventListener("click", productActionHandler));

				if (!VH_SEEN_PRODUCTS[product.asin]) {
					VH_SEEN_PRODUCTS[product.asin] = { ...product };
				}
				if (!VH_TAB_PRODUCTS[tabId]) {
					VH_TAB_PRODUCTS[tabId] = new Set();
				}
				VH_TAB_PRODUCTS[tabId].add(product.asin);

				if (tabAttr.notify && !VH_SEEN_PRODUCTS[product.asin].notified) {
					VH_SEEN_PRODUCTS[product.asin].notified = true;
					let iconUrl = "resource/image/icon-32.png";
					try {
						fetch(product.img_url)
							.then((response) => response.blob())
							.then((blob) => {
								iconUrl = URL.createObjectURL(blob);
								chrome.notifications.create(
									`vh-${product.asin}`,
									{
										type: "basic",
										eventTime: product.date,
										iconUrl: iconUrl,
										title: `${tabAttr.name} - ${product.title}`,
										message: `${product.title}`,
										buttons: [
											{
												title: "Vine Search",
											},
											{
												title: "Hide",
											},
										],
									},
									(notificationId) => {
										VH_NOTIFICATIONS[notificationId] = product.asin;
									}
								);
							})
							.catch((e) => {
								console.error("Failed to fetch image", product.img_url, e);
							});
					} catch (e) {
						console.error("Notification Failed", e);
					}
				}

				fragment.appendChild(productClone);
				productCount++;
			});

			container.innerHTML = "";
			container.appendChild(fragment);
			document.getElementById(`tab-${tabId}-nav`).querySelector(".badge").textContent = productCount;
		}
		// tooltips are buggy, sometimes they'll pop open but you can't dismiss them.
		document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => new window.bootstrap.Tooltip(el));
	};

	/** Search */
	let searchText = null;
	document.getElementById("search-btn").addEventListener("click", () => {
		loading.classList.toggle("d-none", false);
		searchText = document.getElementById("search-input").value;
		renderProducts(VH_SEEN_PRODUCTS, searchText);
		loading.classList.toggle("d-none", true);
	});

	/** Feed Controls */
	const vhFeedControls = document.querySelector(".vh-feed-controls");
	const vhFeedControlsBtnsHandler = (event) => {
		const action = event.target.dataset.action;
		switch (action) {
			case "start":
				chrome.runtime.sendMessage({ type: "feed", action: "start" });
				toast.show({ title: "Feed", message: "Feed started" });
				vhFeedControls.querySelector(".vh-feed-paused").classList.toggle("d-none", true);
				vhFeedControls.querySelector(".vh-feed-active").classList.toggle("d-none", false);
				break;
			case "stop":
				chrome.runtime.sendMessage({ type: "feed", action: "stop" });
				toast.show({ title: "Feed", message: "Feed paused" });
				vhFeedControls.querySelector(".vh-feed-paused").classList.toggle("d-none", false);
				vhFeedControls.querySelector(".vh-feed-active").classList.toggle("d-none", true);
				break;
		}
	};
	vhFeedControls.querySelectorAll(".bi").forEach((btn) => btn.addEventListener("click", vhFeedControlsBtnsHandler));

	/** Service Worker Listener */
	const lastUpdatedTime = document.getElementById("last-updated-time");
	chrome.runtime.onMessage.addListener((msg) => {
		if (msg.type === "etv") {
			const asin = msg.data?.asin;
			const etv = msg.data?.etv;
			if (!asin || !etv) return;

			console.log("etv", msg.data?.asin, msg.data?.etv);
			const product = VH_SEEN_PRODUCTS[asin];
			if (product) {
				product.etv = etv;
				renderProducts(VH_SEEN_PRODUCTS, searchText);
			}
		}

		if (msg.type == "newItemCheck") {
			lastUpdatedTime.classList.toggle("d-none", true);
			loading.classList.toggle("d-none", false);
		}
		if (msg.type == "newProducts") {
			loading.classList.toggle("d-none", false);
			for (const product of msg.products) {
				if (VH_SEEN_PRODUCTS[product.asin]?.etv !== null && VH_SEEN_PRODUCTS[product.asin]?.etv !== undefined) {
					continue;
				}
				VH_SEEN_PRODUCTS[product.asin] = {
					...product,
				};
			}

			renderProducts(VH_SEEN_PRODUCTS, searchText);
			loading.classList.toggle("d-none", true);
			lastUpdatedTime.classList.toggle("d-none", false);
			lastUpdatedTime.innerText = `${vine.formatDate(new Date())}`;
		}
	});

	/** Settings */
	const settingsModal = document.getElementById("vh-settings");
	const settingsTabTemplate = document.getElementById("templateSettingsTabInput").content;
	settingsModal.addEventListener("show.bs.modal", (event) => {
		const settings = VH_SIDE_PANEL_SETTINGS;

		const tabContainer = settingsModal.querySelector(".vh-input-settings-tab-container");
		const modalBody = settingsModal.querySelector(".modal-body");
		const dynamiicSettings = modalBody.querySelector(".dynamic-settings");
		dynamiicSettings.innerHTML = "";

		const renderSettings = (group, settings, container) => {
			Object.entries(settings).forEach(([key, setting]) => {
				const settingContainer = document.createElement("div");
				settingContainer.classList.add("row");

				const label = document.createElement("label");
				label.classList.add("form-label");
				label.classList.add("col-sm-5");
				label.htmlFor = `${group}.options.${key}.value`;
				label.textContent = setting.label;
				settingContainer.appendChild(label);

				const inputContainer = document.createElement("div");
				inputContainer.classList.add("col-sm-7");

				if (setting.type === "select") {
					const select = document.createElement("select");
					select.classList.add("form-select");
					select.id = `${group}.options.${key}.value`;
					select.name = `${group}.options.${key}.value`;
					setting.options.forEach((option) => {
						const optionEl = document.createElement("option");
						optionEl.value = option;
						optionEl.textContent = option;
						if (option === setting.value) {
							optionEl.selected = true;
						}
						select.appendChild(optionEl);
					});
					inputContainer.appendChild(select);
				} else if (setting.type === "checkbox") {
					const input = document.createElement("input");
					input.classList.add("form-check-input");
					input.id = `${group}.options.${key}.value`;
					input.name = `${group}.options.${key}.value`;
					input.type = setting.type;
					input.checked = setting.value;
					inputContainer.appendChild(input);
				} else {
					const input = document.createElement("input");
					input.classList.add("form-control");
					input.id = `${group}.options.${key}.value`;
					input.name = `${group}.options.${key}.value`;
					input.type = setting.type;
					input.value = setting.value;
					inputContainer.appendChild(input);
				}

				if (setting.units) {
					inputContainer.classList.add("input-group");
					const units = document.createElement("span");
					units.classList.add("input-group-text");
					units.textContent = setting.units;
					inputContainer.appendChild(units);
				}
				settingContainer.appendChild(inputContainer);

				container.appendChild(settingContainer);
			});
		};

		for (const [key, setting] of Object.entries(settings)) {
			if (setting.isConfigurable) {
				const settingsContainer = document.createElement("div");
				settingsContainer.classList.add("d-flex", "flex-column");

				const heading = document.createElement("h5");
				heading.textContent = setting.title;
				settingsContainer.appendChild(heading);

				renderSettings(key, setting.options, settingsContainer);
				dynamiicSettings.appendChild(settingsContainer);
			}
		}

		VH_SIDE_PANEL_SETTINGS.tabs = VH_SIDE_PANEL_SETTINGS.tabs || {};
		Object.entries(settings.tabs).forEach(([tabId, tab]) => {
			if (tabContainer.querySelector(`input[name='tabs.${tabId}.name']`)) {
				return;
			}

			const tabClone = document.importNode(settingsTabTemplate, true);
			tabClone.querySelector(".bi-trash").addEventListener("click", (event) => {
				event.target.closest(".vh-input-settings-tab").remove();
			});
			tabClone.querySelectorAll("input").forEach((input) => {
				input.name = input.name.replace("ID", tabId);
				const value = tab[input.name.split(".").pop()];
				if (input.type === "checkbox") {
					input.id = input.id.replace("ID", tabId);
					input.checked = value;
				} else {
					input.value = value;
				}
			});
			tabClone.querySelectorAll("label").forEach((label) => {
				label.htmlFor = label.htmlFor.replace("ID", tabId);
			});
			tabClone.querySelectorAll("label .bi-regex").for = `tabs.${tabId}.isRegex`;
			tabContainer.appendChild(tabClone);
		});

		settingsModal.querySelector(".vh-input-settings-tab-add").addEventListener("click", () => {
			const tabClone = document.importNode(settingsTabTemplate, true);
			tabClone.querySelector(".bi-trash").addEventListener("click", (event) => {
				event.target.closest(".vh-input-settings-tab").remove();
			});
			const tabId = `tab-${tabContainer.children.length}`;
			tabClone.querySelectorAll("input").forEach((input) => {
				input.name = input.name.replace("ID", tabId);
				if (input.type === "checkbox") {
					input.id = input.id.replace("ID", tabId);
				}
			});
			tabClone.querySelectorAll("label").forEach((label) => {
				label.htmlFor = label.htmlFor.replace("ID", tabId);
			});
			tabContainer.appendChild(tabClone);
		});
		settingsModal.querySelector("#save-settings").addEventListener("click", async () => {
			settings.tabs = {};
			settingsModal.querySelectorAll("input").forEach((input) => {
				const keys = input.name.split(".");
				keys.reduce((acc, key, index) => {
					if (index === keys.length - 1) {
						acc[key] = input.type === "checkbox" ? input.checked : input.value;
					} else {
						acc[key] = acc[key] || {};
					}
					return acc[key];
				}, settings);
			});
			settingsModal.querySelectorAll("select").forEach((input) => {
				const keys = input.name.split(".");
				keys.reduce((acc, key, index) => {
					if (index === keys.length - 1) {
						acc[key] = input.selectedOptions[0].value;
					} else {
						acc[key] = acc[key] || {};
					}
					return acc[key];
				}, settings);
			});
			console.log("Saving settings", settings);
			await chrome.storage.local.set({ vhSidePanel: settings });

			document.querySelector("html").dataset.bsTheme = settings.interface.options.theme.value;
			renderTabs(settings.tabs);
			settingsModal.querySelector(".btn-close").click();
		});
	});

	/** Keyboard Shortcuts */
	const keyMap = {
		h: () => {
			const tabId = document.querySelector("#vh-tabs-nav .nav-link.active").dataset.id;
			Array.from(VH_TAB_PRODUCTS?.[tabId] || []).forEach((asin) => {
				if (VH_PINNED[asin]) return;

				VH_HIDDEN_ITEMS[asin] = Date.now();
				document.querySelectorAll("#vh-tabs-nav .nav-link").forEach((tab) => {
					const tabId = tab.dataset.id;
					if (VH_TAB_PRODUCTS?.[tabId]?.has(asin)) {
						document.getElementById(`${tabId}-${asin}`)?.remove();
						VH_TAB_PRODUCTS[tabId].delete(asin);
					}
				});
				delete VH_SEEN_PRODUCTS[asin];
			});
			renderProducts(VH_SEEN_PRODUCTS, searchText);
		},
		n: () => {
			const tabs = document.querySelectorAll("#vh-tabs-nav .nav-link");
			const tabId = document.querySelector("#vh-tabs-nav .nav-link.active").dataset.id;
			const nextTab = Array.from(tabs).findIndex((tab) => tab.dataset.id === tabId) + 1;

			if (nextTab < tabs.length) {
				tabs[nextTab].click();
			}
		},
		p: () => {
			const tabs = document.querySelectorAll("#vh-tabs-nav .nav-link");
			const tabId = document.querySelector("#vh-tabs-nav .nav-link.active").dataset.id;
			const prevTab = Array.from(tabs).findIndex((tab) => tab.dataset.id === tabId) - 1;

			if (prevTab >= 0) {
				tabs[prevTab].click();
			}
		},
		13: {
			handler: (event) => {
				if (event.target.tagName.toLowerCase() === "input" && event.target.id === "search-input") {
					document.getElementById("search-btn").click();
				}
			},
			preventInInput: false,
		},
	};
	document.addEventListener("keydown", (event) => {
		let handler = null;
		let preventInInput = true;
		if (keyMap[event.key]) {
			handler = keyMap[event.key];
		} else if (keyMap[event.code]) {
			handler = keyMap[event.code]();
		}

		if (!handler) {
			return;
		}
		if (typeof handler !== "function") {
			handler = handler.handler;
			preventInInput = !!handler?.preventInInput;
		}

		if (["input", "textarea"].includes(event.target.tagName.toLowerCase()) && preventInInput) {
			return;
		}

		event.preventDefault();
		handler(event);
	});

	/** Init */
	document.querySelector("html").dataset.bsTheme = VH_SIDE_PANEL_SETTINGS.interface.options.theme.value;
	renderTabs(VH_SIDE_PANEL_SETTINGS.tabs);
	document.querySelector(".vh-loading").classList.toggle("d-none", true);
	document.querySelector(".vh-loaded").classList.toggle("d-none", false);
})();
