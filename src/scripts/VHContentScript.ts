import { Logger } from "./Logger";
import { VineFetch } from "./VineFetch";
import { Api } from "./Api";
import { Util } from "./Util";
import { GlobalSettings, SettingsFactory, TypeGlobalSettings } from "./Settings";
import { ShadowDOM } from "./ShadowDOM";
import { Changelog } from "./Changelog";

enum InitializedState {
  NotInitialized = 0,
  Initializing = 1,
  Initialized = 2,
}

enum ReadyState {
  Loading = "loading",
  Interactive = "interactive",
  Complete = "complete",
}

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
  protected vineFetch: VineFetch;
  protected util: Util;

  protected initializedState: InitializedState = InitializedState.NotInitialized; // This will be set in the init function based on the document.readyState
  protected settings!: GlobalSettings; // This will be set in the boot function
  protected shadowDOM!: ShadowDOM; // This will be set in the run function

  /**
   * Page functions
   * 
   * This object contains a list of functions to run on the page. We use the key to
   * match the URL's pathname to an array of functions to run on that page. Each function
   * should be an async function that returns a promise. This allows us to run multiple
   * functions on a page and wait for them all to finish in a non-blocking way.
   */
  protected pageFunctions: { [key: string]: Array<() => Promise<void>> } = {
    // '/vine/account': [
    //   this.accountDisplay.bind(this), // displayAccountData on account page
    // ],
  };

  constructor() {
    this.log = new Logger().scope("VHContentScript");
    this.api = new Api({ logger: this.log });
    this.vineFetch = new VineFetch({ logger: this.log });
    this.util = new Util({ logger: this.log });

    document.addEventListener("readystatechange", this.init.bind(this));
  }

  /**
   * Initialize the Vine Helper
   * 
   * This function is responsible for initializing and then running the Vine Helper.
   */
  protected async init(event: Event): Promise<void> {
    const log = this.log;

    // TypeScript doesn't want to make this more specific so we need to assert it to the correct type
    // https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/969#issuecomment-784344870
    const target = event.target as Document;
    log.debug("Ready state changed", target.readyState);

    // If we haven't initialized yet, we need to boot the Vine Helper, our readyState can be anything
    // with the hope that we are in loading or interactive state to optimize for performance.
    if (this.initializedState === InitializedState.NotInitialized) {
      log.info("Booting Vine Helper...");
      this.initializedState = InitializedState.Initializing;

      await this.boot({ logger: log });

      log.info("Booted.");
      this.initializedState = InitializedState.Initialized;
      return;
    }

    if (target.readyState === ReadyState.Complete) {
      // Remove the listener to prevent over running.
      document.removeEventListener("readystatechange", this.init.bind(this));

      // If we're not initalized, we need to wait until initializedState is set to
      // InitializedState.Initialized while not blocking the main thread.
      if (this.initializedState != InitializedState.Initialized) {
        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            log.debug("Waiting for initialization...");
            if (this.initializedState != InitializedState.Initialized) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });
      }

      log.info("Running Vine Helper...");
      return this.run({ logger: log });
    }
  }

  /**
   * Boot Vine Helper
   * 
   * This function is responsible for initializing the Vine Helper and setting anything
   * that is safe to set / start before the page is fully loaded and ready. This allows
   * us to optimize the boot time of the Vine Helper and make sure that we are ready as
   * soon as the page is ready.
   */
  protected async boot({ logger }: { logger: Logger }): Promise<void> {
    const log = logger.scope("boot");

    this.settings = await SettingsFactory.create<GlobalSettings>("settings", this.log);
    this.settings.addEventListener("change", (event) => this.handleSettingsChanged(event as CustomEvent<TypeGlobalSettings>));

    // Get the initial settings and call handleSettingsChanged to apply them
    log.debug("Getting initial settings...");
    this.handleSettingsChanged({ detail: this.settings.get() } as CustomEvent<TypeGlobalSettings>);
  }

  /**
   * Run Vine Helper
   * 
   * This function is responsible for running the Vine Helper once the page is fully
   * loaded and ready. This function should contain all of the logic that is required
   * to run the Vine Helper and interact with the page content.
   */
  protected async run({ logger }: { logger: Logger }): Promise<void> {
    const log = logger.scope("run");

    // Create a closed shadow root for the Vine Helper for our custom elements as to not interfere with the page
    // we want to add bootstrap css and js to the shadow root which then allows us to show our modals, toasts, etc.
    log.debug("Creating shadow root...");
    this.shadowDOM = new ShadowDOM({ logger: log });

    if (await this.gdprAccepted() === false) {
      return;
    }

    // We don't need to hold onto the reference to the Changelog, we just need to create it
    new Changelog({ settings: this.settings, logger: log, shadowRoot: this.shadowDOM.getShadowRoot() });


    // Bootloader functions
    // @TODO injectionScript
    // @TODO setPageTitle
    // @TODO createTabs
    // @TODO topPagination
    // @TODO initInsertBookmarkButton
    // @TODO initFixPreviousButton
    // @TODO initDrawToolbars
    // @TODO initDrawToolbar
  }

  /**
   * Check if the user has accepted the GDPR terms of use.
   * 
   * This uses the setting general.GDPRPopup which has 3 states:
   *  - true = declined
   *  - false = accepted
   *  - undefined = not yet answered
   * 
   * If the user has declined the GDPR terms of use, we will stop the extension from running.
   * 
   * @returns {Promise<boolean>} A promise that resolves when the GDPR has been accepted or declined.
   */
  protected async gdprAccepted() : Promise<boolean> {
    const log = this.log.scope("checkGDPR");

    const isGDPRDeclined = this.settings.getProperty("general.GDPRPopup");
    if (isGDPRDeclined !== false) {
      if (isGDPRDeclined === true) {
        log.warn("GDPR not accepted, stopping.");

        // @TODO: Display an error toast message to the user letting them know that the extension will not work without accepting the GDPR.
        return false;
      }
      if (isGDPRDeclined === undefined) {
        log.info("Asking user to accept or decline GDPR terms of use.");

        // Display the GDPR confirmation dialog
        const GDPRConfirmation = await import("./GDPRConfirmation");
        const gdpr = new GDPRConfirmation.GDPRConfirmation({ settings: this.settings, logger: log, shadowRoot: this.shadowDOM.getShadowRoot() });
        const accepted = await gdpr.confirm();
        if (accepted === false) {
          log.warn("GDPR not accepted, stopping.");

          // @TODO: Display an error toast message to the user letting them know that the extension will not work without accepting the GDPR.
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Handle settings changed event
   * 
   * We use this event to apply the settings to the content script and dynamically
   * change any of the settings that are required to be applied to the content.
   */
  protected handleSettingsChanged(event: CustomEvent<TypeGlobalSettings>) {
    this.log.info("Settings changed", event.detail);

    // Apply or remove dark theme
    document.getElementsByTagName("body")[0].classList.toggle("darktheme", this.settings.getProperty('thorvarium.darktheme', false));
  }
}

new VHContentScript();