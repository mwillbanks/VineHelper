import { storage, Storage } from "webextension-polyfill";
import { Util } from "./Util";
import { Logger } from "./Logger";

/**
 * Abstract class for settings.
 * 
 * @template T - The type of the settings.
 */
abstract class AbstractSettings<T> extends EventTarget {
  /**
   * The name of the settings.
   */
  protected abstract name: string;

  /**
   * The default settings.
   */
  protected abstract defaults: T;

  /**
   * The settings.
   */
  protected settings: T = {} as T;

  /**
   * The utility class.
   */
  protected util: Util;

  /**
   * The logger instance.
   */
  protected logger: Logger;

  /**
   * @param logger - The logger instance.
   */
  constructor({ logger, cb }: { logger: Logger, cb?: (instance: AbstractSettings<T>) => void }) {
    super();

    this.logger = logger.scope(`settings:${name}`);
    this.util = new Util({ logger });

    this.init(cb);
  }

  /**
   * Initialize the settings.
   */
  async init(cb?: (instance: AbstractSettings<T>) => void) {
    this.logger.info("Initializing settings");
    const settings = await this.util.getLocalStorage<T>(this.name, this.defaults);

    this.logger.info("Settings loaded", settings);
    this.settings = this.util.deepFreeze(settings) as T;

    cb && cb(this);

    storage.local.onChanged.addListener(this.localStorageListener.bind(this));
  }

  /**
   * Get the settings.
   * 
   * @returns The settings.
   */
  get() {
    return this.settings;
  }

  /**
   * Clone the settings.
   * 
   * @returns The cloned settings.
   */
  clone() {
    return structuredClone(this.settings);
  }

  /**
   * Set the settings.
   * Stores the settings into localStorage which the event listener will pick up and save into our settings object.
   * 
   * @param settings - The settings to set.
   */
  async set(settings: T) {
    this.logger.info("Updating settings", settings);
    await this.util.setLocalStorage(this.name, settings);
  }

  /**
   * The local storage listener.
   * 
   * @param changes - The changes.
   * @param areaName - The area name.
   */
  protected localStorageListener = (changes: Storage.StorageAreaOnChangedChangesType) => {
    if (changes[this.name]) {
      this.logger.info("Settings changed", changes[this.name]);
      this.settings = this.util.deepFreeze(changes[this.name].newValue) as T;
      this.dispatchEvent(new CustomEvent<T>("change", { detail: this.settings as T }));
    }
  }
}

/**
 * Type for global settings.
 * 
 * @typedef TypeGlobalSettings
 */
export type TypeGlobalSettings = {
  unavailableTab: {
    active: boolean;
    votingToolbar: boolean;
    consensusThreshold: number;
    unavailableOpacity: number;
    selfDiscard: boolean;
    consensusDiscard: boolean;
    compactToolbar: boolean;
  };
  general: {
    uuid: string | null;
    topPagination: boolean;
    displayFirstSeen: boolean;
    bookmark: boolean;
    bookmarkDate: number;
    hideKeywords: string[];
    highlightKeywords: string[];
    displayVariantIcon: boolean;
    versionInfoPopup: number;
    GDPRPopup: boolean;
    firstVotePopup: boolean;
    newItemNotification: boolean;
    displayNewItemNotifications: boolean;
    newItemNotificationImage: boolean;
    hiddenItemsCacheSize: number;
    newItemNotificationSound: boolean;
    newItemMonitorNotificationSound: boolean;
  };
  keyBindings: {
    active: boolean;
    nextPage: string;
    previousPage: string;
    RFYPage: string;
    AFAPage: string;
    AIPage: string;
    hideAll: string;
    showAll: string;
    debug: string;
  };
  hiddenTab: {
    active: boolean;
    remote: boolean;
  };
  discord: {
    active: boolean;
    guid: string | null;
  };
  thorvarium: {
    darktheme: boolean;
    mobileios: boolean;
    mobileandroid: boolean;
    smallItems: boolean;
    removeHeader: boolean;
    removeFooter: boolean;
    removeAssociateHeader: boolean;
    moreDescriptionText: boolean;
    ETVModalOnTop: boolean;
    categoriesWithEmojis: boolean;
    paginationOnTop: boolean;
    collapsableCategories: boolean;
    stripedCategories: boolean;
    limitedQuantityIcon: boolean;
    RFYAFAAITabs: boolean;
  };
};

/**
 * Class for global settings.
 * 
 * @template TypeGlobalSettings - The type of the global settings.
 */
export class GlobalSettings extends AbstractSettings<TypeGlobalSettings> {
  name = "settings";
  defaults = {
    discord: {
      active: false,
      guid: null,
    },
    general: {
      bookmark: false,
      bookmarkDate: 0,
      displayFirstSeen: true,
      displayNewItemNotifications: false,
      displayVariantIcon: false,
      firstVotePopup: true,
      GDPRPopup: true,
      hiddenItemsCacheSize: 9,
      hideKeywords: [],
      highlightKeywords: [],
      newItemMonitorNotificationSound: false,
      newItemNotification: false,
      newItemNotificationImage: true,
      newItemNotificationSound: false,
      topPagination: true,
      uuid: null,
      versionInfoPopup: 0,
    },
    hiddenTab: {
      active: true,
      remote: false,
    },
    keyBindings: {
      active: true,
      AFAPage: "a",
      AIPage: "i",
      debug: "d",
      hideAll: "h",
      nextPage: "n",
      previousPage: "p",
      RFYPage: "r",
      showAll: "s",
    },
    thorvarium: {
      categoriesWithEmojis: false,
      collapsableCategories: false,
      ETVModalOnTop: false,
      limitedQuantityIcon: false,
      mobileandroid: false,
      mobileios: false,
      moreDescriptionText: false,
      paginationOnTop: false,
      removeAssociateHeader: false,
      removeFooter: false,
      removeHeader: false,
      RFYAFAAITabs: false,
      smallItems: false,
      stripedCategories: false,
    },
    unavailableTab: {
      active: true,
      compactToolbar: false,
      consensusDiscard: true,
      consensusThreshold: 2,
      selfDiscard: true,
      unavailableOpacity: 100,
      votingToolbar: true,
    },
  };
}

/**
 * Type for side panel settings setting option.
 * 
 * @typedef TypeSidePanelSettingsSettingOption
 */
export type TypeSidePanelSettingsSettingOption = {
  label: string;
  type: string;
  value: any;
  units?: string;
  options?: string[];
}

/**
 * Type for side panel settings setting.
 * 
 * @typedef TypeSidePanelSettingsSetting
 */
export type TypeSidePanelSettingsSetting = {
  title: string;
  isConfigurable: boolean;
  options: {
    [key: string]: TypeSidePanelSettingsSettingOption;
  };
}

/**
 * Type for side panel settings tab.
 * 
 * @typedef TypeSidePanelSettingsTab
 */
export type TypeSidePanelSettingsTab = {
  isRegex: boolean;
  isZeroEtv: boolean;
  name: string;
  search: string | null;
  notify: boolean;
};

/**
 * Type for side panel settings.
 * 
 * @typedef TypeSidePanelSettings
 */
export type TypeSidePanelSettings = {
  feed: TypeSidePanelSettingsSetting;
  interface: TypeSidePanelSettingsSetting;
  tabs: {
    [key: string]: TypeSidePanelSettingsTab;
  };
};

/**
 * Class for side panel settings.
 * 
 * @template TypeSidePanelSettings - The type of the side panel settings.
 */
export class SidePanelSettings extends AbstractSettings<TypeSidePanelSettings> {
  name = "vhSidePanel";
  defaults = {
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
};

/**
 * Factory class for settings.
 */
export class SettingsFactory {
  /**
   * The instances.
   */
  private static instances: { [key: string]: AbstractSettings<any> } = {};

  /**
   * The instance name to type.
   */
  private static instanceNameToType: { [key: string]: typeof GlobalSettings | typeof SidePanelSettings } = {
    settings: GlobalSettings,
    vhSidePanel: SidePanelSettings,
  };

  /**
   * Create a settings instance.
   * 
   * @param name - The name of the settings.
   * @param logger - The logger instance.
   * @returns The settings instance.
   * @throws Error if the settings are not found.
   */
  static async create<T>(name: string, logger: Logger): Promise<T> {
    if (SettingsFactory.instances[name]) {
      return SettingsFactory.instances[name] as T;
    }

    if (SettingsFactory.instanceNameToType[name]) {
      return new Promise<T>((resolve) => {
        SettingsFactory.instances[name] = new SettingsFactory.instanceNameToType[name]({
          logger, cb: () => {
            resolve(SettingsFactory.instances[name] as T);
          }
        });
      });
    }

    throw new Error(`Settings ${name} not found`);
  }
}