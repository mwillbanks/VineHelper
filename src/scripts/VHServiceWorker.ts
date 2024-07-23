import browser, { Runtime } from "webextension-polyfill"; // Cross-Browser Compatibility
import { Socket, io } from "socket.io-client"; // Websockets
import { Vine } from "./Vine"; // Vine API & Attributes
import { Logger } from "./Logger"; // Logging
import { Api } from "./Api"; // VineHelper Server API
import { GlobalSettings, SettingsFactory, TypeGlobalSettings } from "./Settings"; // Settings
import { Constants } from "./Constants"; // Constants

/**
 * Vine Helper Service Worker
 * 
 * This class is responsible for managing the Vine Helper service worker. It initializes the service worker
 * and sets up the broadcast channel, feed, log, settings, vine, websocket and various listeners. This class
 * is the main interaction for communicating with APIs and ensuring inner-app communication.
 */
class VHServiceWorker {

	protected api: Api;
	protected log: Logger;
	protected vine: Vine;
	protected settings!: GlobalSettings; // This will be set in the init function
	protected websocket!: Socket // We force unwrap the check (!) as we initialize this through a method in the constructor

	/**
	 * The broadcast channel.
	 * 
	 * This channel is used to communicate between the service worker and the content script.
	 */
	protected broadcastChannel: BroadcastChannel = new BroadcastChannel("vh");
	/**
	 * If the product feed for the side panel is enabled.
	 */
	protected feedIsEnabled: boolean = true;

	/**
	 * Constructor
	 * 
	 * This method initializes the class and sets the log, vine, and api attributes. It also initializes the service worker.
	 */
	constructor() {
		this.log = new Logger().scope("VHServiceWorker");
		this.vine = new Vine();
		this.api = new Api({ logger: this.log });
		this.init();
	}

	/**
	 * Initialize
	 * 
	 * This method initializes the service worker and sets up the broadcast channel, log, settings, vine and websocket.
	 */
	protected async init() {
		this.log.info("Initializing VHServiceWorker...");

		browser.runtime.onStartup.addListener(async () => {
			this.log.info("Extension started.");
		});

		await this.initSettings();
		browser.runtime.onInstalled.addListener(this.onInstalled.bind(this));
		this.initWebsocket();
		this.initMessageListeners();

		this.log.info("VHServiceWorker initialized.");
	}

	/**
	 * Initialize Settings
	 */
	protected async initSettings(): Promise<void> {
		this.settings = await SettingsFactory.create<GlobalSettings>("settings", this.log);
		this.settings.addEventListener("change", (event) => {
			const customEvent = event as CustomEvent<TypeGlobalSettings>;
			const settings = customEvent.detail;

			this.broadcastChannel.postMessage({
				type: "settings",
				settings: settings,
			});
		});
	}

	/**
	 * On Installed
	 * 
	 * This method is called when the extension is installed or updated.
	 */
	protected async onInstalled(details: Runtime.OnInstalledDetailsType) {
		this.log.info("Extension installed or updated:", details.reason);

		if (["install", "update"].includes(details.reason)) {
			await this.settings.setProperties({
				"general.versionCurrent": browser.runtime.getManifest().version,
				"general.versionPrevious": details.previousVersion,
				"general.versionInfoPopup": !!details.previousVersion,
			});
		};
	}

	/**
	 * Initialize message listeners
	 */
	protected initMessageListeners() {
		browser.runtime.onMessage.addListener(async (message, _sender, _sendResponse) => {
			const log = this.log.scope("messageListener");
			log.debug("Received message:", message);

			if (message.type === "keepAlive") {
				log.debug("Received keep alive message.");
				return { success: true };
			}
			if (message.type === "feed") {
				if (message.action === "start") {
					log.debug("Starting feed.");
					return { success: true };
				}
				if (message.action === "stop") {
					log.debug("Stopping feed.");
					return { success: true };
				}
			}
			if (message.type === "infiniteWheelFixed") {
				log.debug("Infinite wheel fixed.");
				return { success: true };
			}
			if (message.type === "etv") {
				log.debug("ETV reported.");
				return { success: true };
			}
			if (message.type === "error") {
				log.error("Error reported:", message.data.error);
				return { success: true };
			}
			if (message.type === "order") {
				log.debug("Order reported.");
				return { success: true };
			}
		});
	}

	/**
	 * Initialize websocket
	 */
	protected initWebsocket() {
		const log = this.log.scope("websocket");

		log.debug("Initializing websocket.");
		this.websocket = io(Constants.WSS_URL, {
			autoConnect: false,
			forceNew: true,
			transports: ["websocket", "polling"],
			reconnection: true,
			reconnectionDelayMax: 5000,
			rememberUpgrade: true,
			withCredentials: true,
			timeout: 5000,
			auth: {
				token: ["755c8705-f3d6-11ee-938b-fa163edeed4d", "com"].join("|"),
			},
		});

		this.websocket.on("connect", () => {
			log.info("Connected to websocket.");

			this.websocket.on("disconnect", () => {
				log.info("Disconnected from websocket.");
			});
		});

		this.websocket.on("connect_error", (err) => {
			log.error("Failed to conenct to websocket.", err);
		});

		this.websocket.on("error", (error) => {
			log.error("Websocket error:", error);
		});

		this.websocket.on("products", async (data) => {
			log.debug("Received product data:", data);

			if (!this.feedIsEnabled) {
				log.debug("Feed is disabled, ignoring data.");
				return;
			}

			// Send data to content script
			this.broadcastChannel.postMessage({
				type: "feed",
				data: data,
			});
		});

		this.websocket.connect();
	}
}

try {
	new VHServiceWorker();
} catch (e) {
	console.error("Error initializing VHServiceWorker:", e);
	(e as Error).message = "Error initializing VHServiceWorker: " + (e as Error).message + "\n" + (e as Error).stack;
	throw e;
}