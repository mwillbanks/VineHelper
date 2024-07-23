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

    this.logger = logger;
    this.util = new Util({ logger });

    // only because javascript classes are janky and the abstract class is initialized before the child class
    setTimeout(() => {
      this.init(cb);
    }, 0);
  }

  /**
   * Initialize the settings.
   */
  async init(cb?: (instance: AbstractSettings<T>) => void) {
    this.logger = this.logger.scope(`settings:${this.name}`)
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
   * Set Property
   * Takes a key and value where the key in object dot notation and sets the value of the property. When the key;s
   * prefix is not found, it will create the prefix unless throwIfPrefixNotFound is set to true.
   */
  async setProperty(key: string, value: any, throwIfPrefixNotFound = false) {
    const settings = this.clone();
    this.util.objPropertySetDeep(settings, key, value, throwIfPrefixNotFound);
    await this.set(settings);
  }

  /**
   * Set Properties
   * Takes an object of key value pairs where the key is in object dot notation and sets the value of the property.
   * This is an optimization over setProperty as it only saves the settings once.
   */
  async setProperties(properties: { [key: string]: any }) {
    const settings = this.clone();
    for (const key in properties) {
      this.util.objPropertySetDeep(settings, key, properties[key]);
    }
    await this.set(settings);
  }

  /**
   * Get Property
   * Takes a key in object dot notation and returns the value of the property.
   */
  getProperty(key: string, defaultValue?: any) {
    return this.util.objPropertyGetDeep(this.settings, key, defaultValue);
  }

  /**
   * Get Properties
   * Takes an array of key value pairs where the key is in object dot notation and the value is the default value.
   * 
   * @param {string[] | [string, any][]} - The properties to get.
   * @returns {any[]} - The values of the properties.
   */
  getProperties(properties: string[] | [string, any][]): any[] {
    const settings: any = [];
    for (const prop of properties) {
      const key = Array.isArray(prop) ? prop[0] : prop;
      const defaultValue = Array.isArray(prop) ? prop[1] : undefined;
      settings.push(this.util.objPropertyGetDeep(this.settings, key, defaultValue));
    }
    return settings;
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
    bookmark: boolean;
    bookmarkDate: number;
    displayFirstSeen: boolean;
    displayNewItemNotifications: boolean;
    displayVariantIcon: boolean;
    firstVotePopup: boolean;
    GDPRPopup: boolean;
    hiddenItemsCacheSize: number;
    hideKeywords: string[];
    highlightKeywords: string[];
    newItemMonitorNotificationSound: boolean;
    newItemNotification: boolean;
    newItemNotificationImage: boolean;
    newItemNotificationSound: boolean;
    topPagination: boolean;
    uuid: string | null;
    versionCurrent: string;
    versionInfoPopup: boolean;
    versionPrevious: string | undefined;
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
    categoriesWithEmojis: boolean;
    collapsableCategories: boolean;
    darktheme: boolean;
    ETVModalOnTop: boolean;
    limitedQuantityIcon: boolean;
    mobileandroid: boolean;
    mobileios: boolean;
    moreDescriptionText: boolean;
    paginationOnTop: boolean;
    removeAssociateHeader: boolean;
    removeFooter: boolean;
    removeHeader: boolean;
    RFYAFAAITabs: boolean;
    smallItems: boolean;
    stripedCategories: boolean;
  };
};

/**
 * Class for global settings.
 * 
 * @template TypeGlobalSettings - The type of the global settings.
 */
export class GlobalSettings extends AbstractSettings<TypeGlobalSettings> {
  protected name = "settings";
  protected defaults = {
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
      versionCurrent: "0.0.0",
      versionPrevious: undefined,
      versionInfoPopup: false,
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
      darktheme: false,
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

  constructor({ logger, cb }: { logger: Logger, cb?: (instance: AbstractSettings<TypeGlobalSettings>) => void }) {
    super({ logger, cb });
  }
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
  protected name = "vhSidePanel";
  protected defaults = {
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

  constructor({ logger, cb }: { logger: Logger, cb?: (instance: AbstractSettings<TypeSidePanelSettings>) => void }) {
    super({ logger, cb });
  }
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