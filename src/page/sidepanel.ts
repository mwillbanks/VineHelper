import browser from "webextension-polyfill";
import { Brenda } from "../scripts/Brenda";
import { Toast } from "../scripts/Toast";
import { Logger } from "../scripts/Logger";
import { Vine } from "../scripts/Vine";
import { GlobalSettings, SettingsFactory, SidePanelSettings, TypeGlobalSettings, TypeSidePanelSettings, TypeSidePanelSettingsSetting, TypeSidePanelSettingsTab } from "../scripts/Settings";
import { ListManagerFactory, TypeProduct, TypeHiddenProduct, TypeNotificationItem, ProductListManager, PinnedProductListManager, HiddenProductListManager, NotificationListManager } from "../scripts/ListManager";
import { SortedSet } from "collections/sorted-set";

const logger = new Logger();
(async () => {
	const log = logger.scope("sidePanel");
	const toast = new Toast({ logger: log });
	const vine = new Vine();
	let searchText: string | null = null;

	const [settingsSitePanel, settings] = await Promise.all([
		SettingsFactory.create<SidePanelSettings>("vhSidePanel", log),
		SettingsFactory.create<GlobalSettings>("settings", log),
	]);

	let VH_SIDE_PANEL_SETTINGS = settingsSitePanel.get();
	let VH_SETTINGS = settings.get();

	settingsSitePanel.addEventListener("change", (event) => {
    const customEvent = event as CustomEvent<TypeSidePanelSettings>;
    VH_SIDE_PANEL_SETTINGS = customEvent.detail;
	});

	settings.addEventListener("change", (event) => {
		const customEvent = event as CustomEvent<TypeGlobalSettings>;
		VH_SETTINGS = customEvent.detail;
	});

	const listManagerProduct = ListManagerFactory.create<ProductListManager>("products", log);
	const listManagerPinnedProduct = ListManagerFactory.create<PinnedProductListManager>("pinnedProducts", log);
	const listManagerHiddenProduct = ListManagerFactory.create<HiddenProductListManager>("hiddenProducts", log);
	const listManagerNotification = ListManagerFactory.create<NotificationListManager>("notifications", log);

	listManagerProduct.addEventListener("removedMultiple", (event) => {
		const customEvent = event as CustomEvent<string[]>;
		for (const asin of customEvent.detail) {
			const product = listManagerPinnedProduct.one({ asin } as TypeProduct);
			if (product) {
				listManagerProduct.put(product);
			}
		}
		renderProducts(listManagerProduct.all(), searchText);
	});

	listManagerProduct.addEventListener("removed", (event) => {
		const customEvent = event as CustomEvent<TypeProduct>;
		const product = customEvent.detail;
		if (listManagerPinnedProduct.has(product)) {
			listManagerProduct.remove(product);
		}
		renderProducts(listManagerProduct.all(), searchText);
	});

	["created", "updated", "cleared"].forEach((eventName) => {
		listManagerProduct.addEventListener(eventName, () => {
			renderProducts(listManagerProduct.all(), searchText);
		});
	});

	listManagerPinnedProduct.addEventListener("created", (event) => {
		const customEvent = event as CustomEvent<TypeProduct>;
		const product = customEvent.detail;
		listManagerProduct.put(product);
	});

	listManagerPinnedProduct.addEventListener("removed", (event) => {
		const customEvent = event as CustomEvent<TypeProduct>;
		const product = customEvent.detail;
		product.pinned = false;
		listManagerProduct.put(product);
	});

	listManagerPinnedProduct.addEventListener("removedMultiple", (event) => {
		const customEvent = event as CustomEvent<string[]>;
		for (const asin of customEvent.detail) {
			const product = listManagerProduct.one({ asin } as TypeProduct);
			if (product) {
				product.pinned = false;
				listManagerProduct.put(product);
			}
		}
	});

	["created", "updated", "removed", "removedMultiple", "cleared"].forEach((eventName) => {
		listManagerHiddenProduct.addEventListener(eventName, () => {
			renderProducts(listManagerProduct.all(), searchText);
		});
	});

	let BRENDA: Brenda;
	if (VH_SETTINGS?.discord?.guid) {
		BRENDA = new Brenda({
			domain: vine.domain,
			guid: VH_SETTINGS.discord.guid as string,
			logger: log,
			toast,
		});
	}

	// @TODO refactor to a ListManager
	const VH_TAB_PRODUCTS: Record<string, Set<string>> = {};

	/** Notification Event Handlers */
	browser.notifications.onClosed.addListener((notificationId) => {
		if (listManagerNotification.has({ id: notificationId } as TypeNotificationItem)) {
			listManagerNotification.remove({ id: notificationId } as TypeNotificationItem);
		}
	});
	browser.notifications.onClicked.addListener((notificationId: string) => {
		const notification = listManagerNotification.one({ id: notificationId } as TypeNotificationItem);
		if (!notification) {
			listManagerNotification.remove({ id: notificationId } as TypeNotificationItem);
		}

		const product = listManagerProduct.one({ asin: notification!.asin } as TypeProduct);
		if (!product) {
			listManagerNotification.remove({ id: notificationId } as TypeNotificationItem);
		}

		window.open(`${vine.url}/vine/vine-items?search=${product!.search}`, "_blank");
		listManagerNotification.remove({ id: notificationId } as TypeNotificationItem);
	});
	browser.notifications.onButtonClicked.addListener((notificationId: string, buttonIndex: number) => {
		const notification = listManagerNotification.one({ id: notificationId } as TypeNotificationItem);
		if (!notification) {
			listManagerNotification.remove({ id: notificationId } as TypeNotificationItem);
		}

		const product = listManagerProduct.one({ asin: notification!.asin } as TypeProduct);
		if (!product) {
			listManagerNotification.remove({ id: notificationId } as TypeNotificationItem);
		}

		if (buttonIndex === 0) {
			window.open(`${vine.url}/vine/vine-items?search=${product!.search}`, "_blank");
		}
		listManagerNotification.remove({ id: notificationId } as TypeNotificationItem);
	});

	const loading = document.querySelector<HTMLDivElement>("#last-updated-loader")!;

	/** Product Event Handlers */
	const productActionHandler = (event: MouseEvent | TouchEvent) => {
		const target = event?.target as HTMLElement;
		const action = target.dataset.action as string;
		const asin = target.dataset.asin as string;

		const product = listManagerProduct.one({ asin } as TypeProduct) as TypeProduct;
		switch (action) {
			case "search":
				window.open(`${vine.url}/vine/vine-items?search=${target.dataset.search}`, "_blank");
				break;
			case "view":
				window.open(`${vine.url}/dp/${asin}`, "_blank");
				break;
			case "announce":
				target.remove();

				if (product && product.etvMin !== undefined && BRENDA && !product.announced) {
					product.announced = true;
					BRENDA.announce(asin, String(product.etvMin), product.queue);
					listManagerProduct.put(product);
				}
				break;
			case "pin":
				product.pinned = true;
				listManagerPinnedProduct.put(product);
				break;
			case "unpin":
				listManagerPinnedProduct.remove(product);
				break;
			case "hide":
				target.closest(".card")!.remove();
				listManagerHiddenProduct.put({ asin, timestamp: Date.now() } as TypeHiddenProduct);
				break;
		}
	};

	/** Tab Rendering */
	const tabItemTemplate = document.querySelector<HTMLTemplateElement>("#templateTabItem")!.content;
	const tabContentTemplate = document.querySelector<HTMLTemplateElement>("#templateTabContent")!.content;
	const renderTabs = (tabDefs: TypeSidePanelSettings["tabs"]) => {
		const tabArray = Object.entries(tabDefs || {});
		tabArray.unshift([
			"all",
			{
				isRegex: false,
				isZeroEtv: false,
				name: "All",
				search: null, // special case
				notify: false,
			},
		]);

		const tabNavContainer = document.querySelector<HTMLUListElement>("#vh-tabs-nav")!;
		const tabContentContainer = document.querySelector<HTMLDivElement>("#vh-tabs-content")!;
		tabNavContainer.innerHTML = "";
		tabContentContainer.innerHTML = "";

		let tabSelected = true;
		for (let i = 0; i < tabArray.length; i++) {
			const [id, attr] = tabArray[i];

			const tabNav = document.importNode(tabItemTemplate, true);
			const tabContent = document.importNode(tabContentTemplate, true);

			const link = tabNav.querySelector<HTMLLinkElement>(".nav-link")!;
			link.id = `tab-${id}-nav`;
			link.href = `#tab-${id}`;
			link.dataset.bsTarget = `#tab-${id}-content`;
			link.dataset.id = id;
			link.querySelector(".nav-title")!.textContent = attr.name;

			const content = tabContent.querySelector<HTMLDivElement>(".tab-pane")!;
			content.tabIndex = i;
			content.id = `tab-${id}-content`;

			tabContent
				.querySelector<HTMLDivElement>(".vh-products")!
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
	const renderProducts = (products: SortedSet<TypeProduct>, searchText: string | null) => {
		const expiration = Date.now() - 1000 * 60 * VH_SIDE_PANEL_SETTINGS.feed.options.expire.value;
		const template = document.querySelector<HTMLTemplateElement>("#productTemplate")!.content;
		const fragment = document.createDocumentFragment();
		const tabDefs: [string, TypeSidePanelSettingsTab][] = Object.entries(VH_SIDE_PANEL_SETTINGS?.tabs || {});
		tabDefs.unshift([
			"all",
			{
				isRegex: false,
				isZeroEtv: false,
				name: "All",
				search: null, // special case
				notify: false,
			},
		]);
;
		if (searchText) {
			products = products.filter((product: TypeProduct) => product.title.toLowerCase().includes(searchText));
		}

		for (let i = 0; i < tabDefs.length; i++) {
			const [tabId, tabAttr] = tabDefs[i];
			const container = document.querySelector<HTMLDivElement>(`#tab-${tabId}-content .vh-products`)!;

			let searchRegEx: RegExp | null = null;
			if (tabAttr.search && tabAttr.isRegex) {
				try {
					searchRegEx = new RegExp(tabAttr.search);
				} catch (e) {
					console.log("Invalid regex", tabAttr.search, e);
					continue;
				}
			}

			const filteredProducts = products.filter((product: TypeProduct) => {
				const productTitleLc = product.title.toLowerCase();

				if (product.timestamp < expiration) {
					return false;
				}

				if (tabAttr.isZeroEtv && product.etvMin !== 0) {
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
			filteredProducts.forEach((product: TypeProduct) => {
				if (listManagerHiddenProduct.has({ asin: product.asin } as TypeHiddenProduct)) {
					return;
				}

				const productClone = document.importNode(template, true);
				const card = productClone.querySelector<HTMLDivElement>(".card")!;
				card.id = `${tabId}-${product.asin}`;

				const header = card.querySelector<HTMLDivElement>(".card-header")!;
				header.textContent = String(product.title).substring(0, 25);
				header.title = product.title;
				header.dataset.bsTitle = product.title;
				header.dataset.bsPlacement = "top";

				const img = card.querySelector<HTMLImageElement>(".card-img-top")!;
				img.src = product.imgUrl;
				img.alt = product.title;

				const footer = card.querySelector<HTMLDivElement>(".card-footer")!;
				footer.querySelector<HTMLSpanElement>(".time-ago")!.textContent = vine.formatTimeAgo(product.timestamp);
				if (product.etvMin !== undefined) {
					if (product.etvMin === 0) {
						card.classList.add("zero-etv");
					}

					const etvContainer = footer.querySelector(".etv")!;
					etvContainer.classList.toggle("d-none");
					etvContainer.querySelector<HTMLSpanElement>(".etv-value")!.textContent = vine.formatCurrency(product.etvMin);
				}
				const actions = footer.querySelectorAll<HTMLElement>(".btn-group-sm i");
				actions[0].dataset.action = "search";
				actions[0].dataset.asin = product.asin;
				actions[0].dataset.search = encodeURIComponent(product.search);
				actions[1].dataset.action = "pin";
				actions[1].dataset.asin = product.asin;
				if (product.pinned) {
					actions[1].classList.add("d-none");
				}
				actions[2].dataset.action = "unpin";
				actions[2].dataset.asin = product.asin;
				if (!product.pinned) {
					actions[2].classList.add("d-none");
				}
				actions[3].dataset.action = "hide";
				actions[3].dataset.asin = product.asin;
				actions[4].dataset.action = "view";
				actions[4].dataset.asin = product.asin;
				actions[5].dataset.action = "announce";
				actions[5].dataset.asin = product.asin;
				if (product.etvMin === null || product.announced) {
					actions[5].classList.add("d-none");
				}
				actions.forEach((action) => action.addEventListener("click", productActionHandler));

				if (!VH_TAB_PRODUCTS[tabId]) {
					VH_TAB_PRODUCTS[tabId] = new Set();
				}
				VH_TAB_PRODUCTS[tabId].add(product.asin);

				if (tabAttr.notify && !product.notified) {
					product.notified = true;
					let iconUrl = "resource/image/icon-32.png";
					try {
						fetch(product.imgUrl)
							.then((response) => response.blob())
							.then((blob) => {
								iconUrl = URL.createObjectURL(blob);
								browser.notifications.create(
									`vh-${product.asin}`,
									{
										type: "basic",
										eventTime: product.timestamp,
										iconUrl: iconUrl,
										title: `${tabAttr.name} - ${product.title}`,
										message: `${product.title}`,
										isClickable: true,
									}
								).then(
									(notificationId: string) => {
										listManagerNotification.put({ id: notificationId, asin: product.asin } as TypeNotificationItem);
									}
								);
							})
							.catch((e) => {
								log.error("Failed to fetch image", product.imgUrl, e);
							});
					} catch (e) {
						log.error("Notification Failed", e);
					}
				}

				fragment.appendChild(productClone);
				productCount++;
			});

			container.innerHTML = "";
			container.appendChild(fragment);
			document.querySelector<HTMLUListElement>(`#tab-${tabId}-nav`)!.querySelector<HTMLSpanElement>(".badge")!.textContent = String(productCount);
		}

		document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
			// sometimes the tooltip becomes stuck open, by setting a timeout, we can simply force it to close to prevent issues.
			const tooltip = new window.bootstrap.Tooltip(el);
			let timeout: NodeJS.Timeout | null = null;

			el.addEventListener("shown.bs.tooltip", () => {
				timeout = setTimeout(() => {
					tooltip.hide();
				}, 5000);
			});

			el.addEventListener("hidden.bs.tooltip", () => {
				if (timeout) {
					clearTimeout(timeout);
				}
			});
		});
	};

	/** Search */
	document.querySelector<HTMLButtonElement>("#search-btn")!.addEventListener("click", () => {
		loading.classList.toggle("d-none", false);
		searchText = document.querySelector<HTMLInputElement>("#search-input")!.value;
		renderProducts(listManagerProduct.all(), searchText);
		loading.classList.toggle("d-none", true);
	});

	/** Feed Controls */
	const vhFeedControls = document.querySelector<HTMLElement>(".vh-feed-controls")!;
	const vhFeedControlsBtnsHandler = (event : MouseEvent|TouchEvent) => {
		const target = event.target as HTMLElement;
		const action = target.dataset.action;
		switch (action) {
			case "start":
				browser.runtime.sendMessage({ type: "feed", action: "start" });
				toast.show({ title: "Feed", message: "Feed started" });
				vhFeedControls.querySelector<HTMLElement>(".vh-feed-paused")!.classList.toggle("d-none", true);
				vhFeedControls.querySelector<HTMLElement>(".vh-feed-active")!.classList.toggle("d-none", false);
				break;
			case "stop":
				browser.runtime.sendMessage({ type: "feed", action: "stop" });
				toast.show({ title: "Feed", message: "Feed paused" });
				vhFeedControls.querySelector<HTMLElement>(".vh-feed-paused")!.classList.toggle("d-none", false);
				vhFeedControls.querySelector<HTMLElement>(".vh-feed-active")!.classList.toggle("d-none", true);
				break;
		}
	};
	vhFeedControls.querySelectorAll<HTMLElement>(".bi").forEach((btn) => btn.addEventListener("click", vhFeedControlsBtnsHandler));

	/** Service Worker Listener */
	const lastUpdatedTime = document.querySelector<HTMLSpanElement>("#last-updated-time")!;
	browser.runtime.onMessage.addListener((msg) => {
		if (msg.type === "etv") {
			const asin = msg.data?.asin;
			const etv = msg.data?.etv;
			if (!asin || !etv) return;

			log.info("etv", msg.data?.asin, msg.data?.etv);
			const product = listManagerProduct.one({ asin } as TypeProduct);
			if (product) {
				if (product.etvMin === null || product.etvMin === undefined || etv < product.etvMin) {
					product.etvMin = etv;
				} else if (product.etvMax === null || product.etvMax === undefined || etv > product.etvMax) {
					product.etvMax = etv;
				}
				listManagerProduct.put(product);
				renderProducts(listManagerProduct.all(), searchText);
			}
		}

		if (msg.type == "newItemCheck") {
			lastUpdatedTime.classList.toggle("d-none", true);
			loading.classList.toggle("d-none", false);
		}
		if (msg.type == "newProducts") {
			loading.classList.toggle("d-none", false);
			for (const product of msg.products) {
				const existing = listManagerProduct.one({ asin: product.asin } as TypeProduct);
				if (existing?.etvMin !== null && existing?.etvMax !== undefined) {
					continue;
				}
				listManagerProduct.put(product);
			}

			loading.classList.toggle("d-none", true);
			lastUpdatedTime.classList.toggle("d-none", false);
			lastUpdatedTime.innerText = `${vine.formatDate(Date.now())}`;
		}
	});

	/** Settings */
	const settingsModal = document.querySelector<HTMLDivElement>("#vh-settings")!;
	const settingsTabTemplate = document.querySelector<HTMLTemplateElement>("#templateSettingsTabInput")!.content;
	settingsModal.addEventListener("show.bs.modal", () => {
		const settings = VH_SIDE_PANEL_SETTINGS;

		const tabContainer = settingsModal.querySelector<HTMLDivElement>(".vh-input-settings-tab-container")!;
		const modalBody = settingsModal.querySelector<HTMLDivElement>(".modal-body")!;
		const dynamiicSettings = modalBody.querySelector<HTMLDivElement>(".dynamic-settings")!;
		dynamiicSettings.innerHTML = "";

		const renderSettings = (group: string, settings: TypeSidePanelSettingsSetting["options"], container: HTMLDivElement) => {
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
					setting.options?.forEach((option) => {
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
			if (["feed", "interface"].includes(key) && setting.isConfigurable) {
				const configurable = setting as TypeSidePanelSettingsSetting;
				const settingsContainer = document.createElement("div");
				settingsContainer.classList.add("d-flex", "flex-column");

				const heading = document.createElement("h5");
				heading.textContent = configurable.title;
				settingsContainer.appendChild(heading);

				renderSettings(key, configurable.options, settingsContainer);
				dynamiicSettings.appendChild(settingsContainer);
			}
		}

		VH_SIDE_PANEL_SETTINGS.tabs = VH_SIDE_PANEL_SETTINGS.tabs || {};
		Object.entries(settings.tabs).forEach(([tabId, tab]: [string, any]) => {
			if (tabContainer.querySelector(`input[name='tabs.${tabId}.name']`)) {
				return;
			}

			const tabClone = document.importNode(settingsTabTemplate, true);
			tabClone.querySelector<HTMLElement>(".bi-trash")!.addEventListener("click", (event) => {
				const target = event.target as HTMLElement;
				target.closest<HTMLElement>(".vh-input-settings-tab")!.remove();
			});
			tabClone.querySelectorAll("input").forEach((input) => {
				input.name = input.name.replace("ID", tabId);
				const value = tab[input.name.split(".").pop() as any];
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
			tabClone.querySelectorAll<HTMLLabelElement>("label .bi-regex").forEach(el => {
				el.htmlFor = `tabs.${tabId}.isRegex`;
			});
			tabContainer.appendChild(tabClone);
		});

		settingsModal.querySelector<HTMLElement>(".vh-input-settings-tab-add")!.addEventListener("click", () => {
			const tabClone = document.importNode(settingsTabTemplate, true);
			tabClone.querySelector<HTMLElement>(".bi-trash")!.addEventListener("click", (event) => {
				const target = event.target as HTMLElement;
				target.closest<HTMLElement>(".vh-input-settings-tab")!.remove();
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
		settingsModal.querySelector<HTMLElement>("#save-settings")!.addEventListener("click", async () => {
			settings.tabs = {};
			settingsModal.querySelectorAll("input").forEach((input) => {
				const keys = input.name.split(".");
				keys.reduce((acc: any, key, index) => {
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
				keys.reduce((acc: any, key, index) => {
					if (index === keys.length - 1) {
						acc[key] = input.selectedOptions[0].value;
					} else {
						acc[key] = acc[key] || {};
					}
					return acc[key];
				}, settings);
			});
			console.log("Saving settings", settings);
			await browser.storage.local.set({ vhSidePanel: settings });

			document.querySelector<HTMLElement>("html")!.dataset.bsTheme = settings.interface.options.theme.value;
			renderTabs(settings.tabs);
			settingsModal.querySelector<HTMLElement>(".btn-close")!.click();
		});
	});

	/** Keyboard Shortcuts */
	const keyMap: {
		[key: string]: Function | {
			handler: Function,
			preventInInput: boolean,
		}
	} = {
		h: () => {
			const tabId = document.querySelector<HTMLElement>("#vh-tabs-nav .nav-link.active")!.dataset.id as string;
			Array.from(VH_TAB_PRODUCTS?.[tabId] || []).forEach((asin) => {
				if (listManagerPinnedProduct.has({ asin } as TypeProduct)) return;
				listManagerHiddenProduct.put({ asin, timestamp: Date.now() } as TypeHiddenProduct);
				document.querySelectorAll<HTMLElement>("#vh-tabs-nav .nav-link").forEach((tab) => {
					const tabId = tab.dataset.id as string;
					if (VH_TAB_PRODUCTS?.[tabId]?.has(asin)) {
						document.getElementById(`${tabId}-${asin}`)?.remove();
						VH_TAB_PRODUCTS[tabId].delete(asin);
					}
				});
			});
			renderProducts(listManagerProduct.all(), searchText);
		},
		n: () => {
			const tabs = document.querySelectorAll<HTMLElement>("#vh-tabs-nav .nav-link");
			const tabId = document.querySelector<HTMLElement>("#vh-tabs-nav .nav-link.active")!.dataset.id;
			const nextTab = Array.from(tabs).findIndex((tab) => tab.dataset.id === tabId) + 1;

			if (nextTab < tabs.length) {
				tabs[nextTab].click();
			}
		},
		p: () => {
			const tabs = document.querySelectorAll<HTMLElement>("#vh-tabs-nav .nav-link");
			const tabId = document.querySelector<HTMLElement>("#vh-tabs-nav .nav-link.active")!.dataset.id;
			const prevTab = Array.from(tabs).findIndex((tab) => tab.dataset.id === tabId) - 1;

			if (prevTab >= 0) {
				tabs[prevTab].click();
			}
		},
		Enter: {
			handler: (event : KeyboardEvent) => {
				const target = event.target as HTMLElement;
				if (target.tagName.toLowerCase() === "input" && target.id === "search-input") {
					document.querySelector<HTMLElement>("#search-btn")!.click();
				}
			},
			preventInInput: false,
		},
	};
	document.addEventListener("keydown", (event) => {
		let handler = null;
		let preventInInput = true;
		const target = event.target as HTMLElement;

		if (keyMap[event.key]) {
			handler = keyMap[event.key];
		} else if (keyMap[event.code]) {
			handler = keyMap[event.code];
		}

		console.log({ handler, key: event.key, code: event.code, target: target.tagName.toLowerCase() });

		if (!handler) {
			return;
		}
		if (typeof handler !== "function") {
			preventInInput = !!handler.preventInInput;
			handler = handler.handler;
		}

		if (["input", "textarea"].includes(target.tagName.toLowerCase()) && preventInInput) {
			return;
		}

		event.preventDefault();
		handler(event);
	});

	/** Init */
	document.querySelector<HTMLElement>("html")!.dataset.bsTheme = VH_SIDE_PANEL_SETTINGS.interface.options.theme.value;
	renderTabs(VH_SIDE_PANEL_SETTINGS.tabs);
	document.querySelector<HTMLElement>(".vh-loading")!.classList.toggle("d-none", true);
	document.querySelector<HTMLElement>(".vh-loaded")!.classList.toggle("d-none", false);
})();
