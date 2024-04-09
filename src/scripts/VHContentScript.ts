import { Logger } from "./Logger";
import { VineFetch } from "./VineFetch";
import { Api } from "./Api";
import { GlobalSettings, SettingsFactory, TypeGlobalSettings } from "./Settings";

/**
 * Content script for Vine Helper.
 * 
 * We need to migrate all of the behaviors from the bootloader, injectors, and other scripts
 * to this class. This class will be responsible for initializing the Vine Helper and
 * managing the settings and controlling the overall behavior of the webpage content.
 */
class VHContentScript {
	protected api: Api;
	protected log: Logger;
	protected settings: TypeGlobalSettings = {} as TypeGlobalSettings;
	protected vineFetch: VineFetch;

	constructor() {
		this.log = new Logger().scope("VHContentScript");
		this.api = new Api({ logger: this.log });
		this.vineFetch = new VineFetch({ logger: this.log });
		this.init();
	}

	protected async init() {
		this.log.info("Initializing Vine Helper...");

		const settings = await SettingsFactory.create<GlobalSettings>("settings", this.log);
		settings.addEventListener("change", (event) => this.handleSettingsChanged(event as CustomEvent<TypeGlobalSettings>));

    // Get the initial settings and call handleSettingsChanged to apply them
		this.settings = settings.get();
    this.handleSettingsChanged({ detail: this.settings } as CustomEvent<TypeGlobalSettings>);

		this.log.info("Initialized.");
	}

  /**
   * Handle settings changed event
   * 
   * We use this event to apply the settings to the content script and dynamically
   * change any of the settings that are required to be applied to the content.
   */
  protected handleSettingsChanged(event: CustomEvent<TypeGlobalSettings>) {
    this.log.info("Settings changed", event.detail);
    this.settings = event.detail;

    // Apply or remove dark theme
		document.getElementsByTagName("body")[0].classList.toggle("darktheme", this.settings.thorvarium.darktheme);
  }
}

new VHContentScript();