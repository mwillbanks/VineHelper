import browser from "webextension-polyfill";
import { Vine } from "./Vine";
import { Logger } from "./Logger";
import { Api } from "./Api";
import { GlobalSettings, SettingsFactory, TypeGlobalSettings } from "./Settings";

class VHServiceWorker {
	protected api: Api;
	protected broadcastChannel: BroadcastChannel = new BroadcastChannel("vh");
	protected feedIsEnabled: boolean = true;
	protected feedIsRunning: boolean = false;
	protected feedInterval: number = 30000;
	protected feedTimeoutId?: NodeJS.Timeout;
	protected log: Logger;
	protected settings: TypeGlobalSettings = {} as TypeGlobalSettings;
	protected vine: Vine;

	constructor() {
		this.log = new Logger().scope("VHServiceWorker");
		this.vine = new Vine();
		this.api = new Api({ logger: this.log });
		this.init();
	}

	protected async init() {
		this.log.info("Initializing VHServiceWorker...");

		const settings = await SettingsFactory.create<GlobalSettings>("settings", this.log);
		this.settings = settings.get();
		settings.addEventListener("change", (event) => {
			const customEvent = event as CustomEvent<TypeGlobalSettings>;
			this.settings = customEvent.detail;

			this.broadcastChannel.postMessage({
				type: "settings",
				settings: this.settings,
			});
		});
		this.initSidePanelListeners();
		this.initMessageListeners();

		this.log.info("VHServiceWorker initialized.");
	}

	protected initSidePanelListeners() {
		browser.tabs.onUpdated.addListener(async (tabId, _info, tab) => {
			if (!tab.url) return;
	
			browser.sidebarAction
			await browser.sidebarAction.setPanel({
				tabId,
				panel: "pages/sidepanel.html",
			});
		});
	
		browser.runtime.onInstalled.addListener(() => {
			browser.contextMenus.create({
				id: "openSidePanel",
				title: "Open side panel",
				contexts: ["all"],
			});
		});
	
		browser.contextMenus?.onClicked?.addListener((info) => {
			if (info.menuItemId === "openSidePanel") {
				browser.sidebarAction.open();
			}
		});
	}

	protected initMessageListeners() {
		browser.runtime.onMessage.addListener(async (message, _sender, _sendResponse) => {
			if (message.type === "keepAlive") {
				return { success: true };
			}
			if (message.type === "feed") {
				if (message.action === "start") {
					return this.feedIsEnabled = true;
				}
				if (message.action === "stop") {
					return this.feedIsEnabled = false;
				}
			}
		});
	}

	protected async pollFeed() {
		if (!this.feedIsEnabled || this.feedIsRunning) {
			return;
		}
		this.feedIsRunning = true;
		clearTimeout(this.feedTimeoutId);

		const products = await this.api.feed({ orderby: "date", limit: 50 });
		this.broadcastChannel.postMessage({
			type: "feed",
			products,
		});
		
		this.feedTimeoutId = setTimeout(() => this.pollFeed(), this.feedInterval);
	}
}

new VHServiceWorker();