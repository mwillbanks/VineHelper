import SortedSet, { SortedSet as TypeSortedSet } from "collections/sorted-set";
import { Logger } from "./Logger";
import { Util } from "./Util";
import { IndexableType } from "./types";

/**
 * This class is responsible for observing a list manager and saving its items to local storage.
 * 
 * @template IT The item type of the list manager.
 */
class LocalStorageListManagerObserver<IT extends IndexableType> {
  /**
   * @param manager The list manager to observe.
   */
  protected manager: AbstractListManager<IT>;
  /**
   * @param localStorageKey The key to use for local storage.
   */
  protected localStorageKey: string;
  /**
   * @param logger The logger instance.
   */
  protected logger: Logger;
  /**
   * @param util The util instance.
   */
  protected util: Util;
  /**
   * @param timeoutId The timeout ID.
   */
  protected timeoutId: NodeJS.Timeout | null = null;
  /**
   * @param debounce The debounce time.
   */
  protected debounce: number;
  /**
   * @param isSaving Whether the observer is currently saving.
   */
  protected isSaving = false;

  /**
   * Initializes the observer.
   * 
   * @param manager The list manager to observe.
   * @param logger The logger instance.
   * @param localStorageKey The key to use for local storage.
   * @param localStorageDebounce The debounce time.
   */
  constructor({ manager, logger, localStorageKey, localStorageDebounce = 1000 }: { manager: AbstractListManager<IT>, logger: Logger, localStorageKey: string, localStorageDebounce?: number }) {
    this.manager = manager;
    this.localStorageKey = localStorageKey;
    this.logger = logger.scope('localStorageObserver');
    this.util = new Util({ logger: this.logger });
    this.debounce = localStorageDebounce;

    this.logger.debug('Initializing observer');
    this.init();
  }

  /**
   * Initializes the observer.
   * 
   * @returns {Promise<void>}
   */
  private async init(): Promise<void> {
    this.logger.debug('Initializing observer');

    const items = await this.util.getLocalStorage<IT[]>(this.localStorageKey, []);

    items.forEach((item) => {
      this.manager.put(item);
    });

    ["created", "updated", "removed", "removedMultiple", "cleared"].forEach((event) => {
      return this.manager.addEventListener(event, (event: Event) => this.onEvent(event as CustomEvent<any>));
    });
  }

  /**
   * Handles an event.
   * 
   * @param event The event to handle.
   * @returns {void}
   */
  onEvent(event: CustomEvent): void {
    this.logger.debug('Received event', { event });

    if (this.timeoutId) {
      this.logger.debug('Debouncing event');
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(async () => {
      this.isSaving = true;
      await this.save();
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      this.isSaving = false;
    }, this.debounce);
  }

  /**
   * Saves the items to local storage.
   * 
   * @returns {Promise<void>}
   */
  private save(): Promise<void> {
    this.logger.debug('Saving items');

    return this.util.setLocalStorage(this.localStorageKey, this.manager.all().toArray());
  }
}

/**
 * The event list manager created event.
 */
type EventListManagerCreated<T> = CustomEvent<T>;

/**
 * The event list manager updated event.
 */
type EventListManagerUpdated<T> = CustomEvent<{ item: T, changes: (keyof T)[] }>;

/**
 * The event list manager removed event.
 */
type EventListManagerRemoved<T> = CustomEvent<T[keyof T]>;

/**
 * The event list manager removed multiple event.
 */
type EventListManagerRemovedMultiple<T> = CustomEvent<(T[keyof T])[]>;

/**
 * The event list manager cleared event.
 */
type EventListManagerCleared = CustomEvent<undefined>;

/**
 * The event list manager events.
 * 
 * @template T The item type.
 * @property created The created event.
 * @property updated The updated event.
 * @property removed The removed event.
 * @property removedMultiple The removed multiple event.
 * @property cleared The cleared event.
 * @returns {EventListManagerEvents<T>}
 */
type EventListManagerEvents<T> = {
  created: (detail: T) => EventListManagerCreated<T>,
  updated: (detail: { item: T, changes: (keyof T)[] }) => EventListManagerUpdated<T>,
  removed: (detail: T[keyof T]) => EventListManagerRemoved<T>,
  removedMultiple: (detail: (T[keyof T])[]) => EventListManagerRemovedMultiple<T>,
  cleared: () => EventListManagerCleared,
};

/**
 * The abstract list manager.
 * 
 * @template IT The item type.
 */
abstract class AbstractListManager<IT extends IndexableType> extends EventTarget {
  /**
   * The primary key used for the one, has, and remove methods.
   */
  protected primaryKey: keyof IT | null = null;
  /**
   * The sort key used for sorting items.
   */
  protected sortKey: keyof IT | null = null;
  /**
   * The sort function used for sorting items.
   * This is used if the sort key is not set.
   */
  protected sortFunction: ((a: IT, b: IT) => number) | null = null;
  /**
   * The local storage key, if not null, the list manager will be observed and saved to local storage on changes.
   */
  protected localStorageKey: string | null = null;
  /**
   * The logger instance.
   */
  protected logger: Logger;
  /**
   * The items.
   * The items are stored in a sorted set to allow for quick lookups, sorting, iteration and purging.
   */
  protected items: TypeSortedSet<Partial<IT>> = new SortedSet<Partial<IT>>([], (a, b) => {
    if (this.primaryKey) {
      return a[this.primaryKey] === b[this.primaryKey];
    }
    return a === b;
  }, (a, b) => {
    if (this.sortKey) {
      return (a[this.sortKey] as number) - (b[this.sortKey] as number);
    }
    if (this.sortFunction) {
      return this.sortFunction(a as IT, b as IT);
    }
    return 0;
  });

  /**
   * The list manager events.
   * 
   * @returns {EventListManagerEvents<IT>}
   */
  protected events: EventListManagerEvents<IT> = {
    created: (detail: IT) => new CustomEvent('created', { detail: detail }),
    updated: (detail: { item: IT, changes: (keyof IT)[] }) => new CustomEvent('updated', { detail: detail }),
    removed: (detail: IT[keyof IT]) => new CustomEvent('removed', { detail: detail }),
    removedMultiple: (detail: (IT[keyof IT])[]) => new CustomEvent('removedMultiple', { detail: detail }),
    cleared: () => new CustomEvent('cleared'),
  };

  /**
   * Initializes the list manager.
   * 
   * @param logger The logger instance.
   */
  constructor({ logger }: { logger: Logger }) {
    super();

    this.logger = logger.scope('listManager');

    if (this.localStorageKey) {
      new LocalStorageListManagerObserver<IT>({ manager: this, logger, localStorageKey: this.localStorageKey });
    }
  }

  /**
   * Puts an item into the list manager.
   * 
   * @param item The item to put.
   * @param changes The changes to the item.
   * @returns {void}
   */
  put(item: IT, changes: (keyof IT)[] = []): void {
    this.logger.debug('Putting item', { item, changes });
    let event: CustomEvent;
    const index = this.items.indexOf(item);
    if (index !== -1) {
      this.logger.debug('Item already exists, updating', { item });
      this.items.swap(index, 1, item);
      event = this.events.updated({ item, changes });
    } else {
      this.logger.debug('Item does not exist, creating', { item });
      this.items.add(item);
      event = this.events.created(item);
    }

    this.dispatchEvent(event);
  }

  /**
   * Gets all items.
   * Thos method returns a clone of the items to prevent direct manipulation.
   * 
   * @returns {TypeSortedSet<IT>}
   */
  all(): TypeSortedSet<IT> {
    this.logger.debug('Getting all items');

    return this.items.clone();
  }

  /**
   * Checks if an item exists.
   * 
   * @param item The item to check.
   * @returns {boolean}
   */
  has(item: IT): boolean {
    this.logger.debug('Checking item', { item });

    return this.items.has(item);
  }

  /**
   * Gets an item.
   * 
   * @param item The item to get.
   * @returns {IT | undefined}
   */
  one(item: IT): IT | undefined {
    this.logger.debug('Getting item', { item });

    return this.items.get(item) as IT | undefined;
  }

  /**
   * Removes an item.
   * 
   * @param item The item to remove.
   * @returns {boolean}
   */
  remove(item: IT): boolean {
    this.logger.debug('Removing item', { item });

    if (this.items.delete(item)) {
      this.logger.info('Item removed', { item });
      this.dispatchEvent(this.events.removed(item[this.primaryKey as string]));
      return true;
    }

    this.logger.warn('Item not found', { item });
    return false;
  }

  /**
   * Purges items older than a timestamp.
   * 
   * @param timestamp The timestamp to purge items older than.
   * @returns {number} The number of items purged.
   */
  purge(timestamp: number): number {
    this.logger.info('Purging items older than', { timestamp });

    const node = this.items.findGreatestLessThanOrEqual({ [this.sortKey as string]: timestamp } as Partial<IT>);
    this.logger.debug('findGreatestLessThanOrEqual', { node });

    if (node?.length) {
      this.logger.info('Purging item count', { count: node.length });
      const removed = this.items.splice(0, node.length);
      this.dispatchEvent(this.events.removedMultiple(removed.map((item) => item[this.primaryKey as string]!)));
      return removed.length;
    }

    return 0;
  }

  /**
   * Clears all items.
   * 
   * @returns {void}
   */
  clear(): void {
    this.logger.info('Clearing all items');

    this.items.clear();
    this.dispatchEvent(this.events.cleared());
  }

  /**
   * Adds an event listener.
   * 
   * @param type The event type.
   * @param callback The callback.
   * @param options The options.
   * @returns {void}
   */
  addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions | undefined): void {
    this.logger.debug('Adding event listener', { type, callback, options });

    super.addEventListener(type, callback, options);
  }

  /**
   * Removes an event listener.
   * 
   * @param type The event type.
   * @param callback The callback.
   * @param options The options.
   * @returns {void}
   */
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions | undefined): void {
    this.logger.debug('Removing event listener', { type, callback, options });

    super.removeEventListener(type, callback, options);
  }

  /**
   * Dispatches an event.
   * 
   * @param event The event to dispatch.
   * @returns {boolean}
   */
  dispatchEvent(event: Event): boolean {
    this.logger.debug('Dispatching event', { event });

    return super.dispatchEvent(event);
  }
}

/**
 * The product queue type.
 */
export enum TypeProductQueue {
  RFY = 'RFY',
  AFA = 'AFA',
  AI = 'AI',
}

/**
 * The product type.
 * 
 * @property asin The ASIN.
 * @property parentAsin The parent ASIN.
 * @property queue The queue.
 * @property timestamp The timestamp.
 * @property imgUrl The image URL.
 * @property search The search.
 * @property title The title.
 * @property etvMin The minimum ETV.
 * @property etvMax The maximum ETV.
 * @property feeYes The fee yes.
 * @property feeNo The fee no.
 * @property orderYes The order yes.
 * @property orderNo The order no.
 * @property announced The announced.
 * @property notified The notified.
 * @property ordered The ordered.
 * @property fee The fee.
 * @returns {TypeProduct}
 */
export type TypeProduct = {
  asin: string;
  parentAsin?: string;
  queue: TypeProductQueue;
  timestamp: number;
  imgUrl: string;
  search: string;
  title: string;
  etvMin?: number;
  etvMax?: number;
  feeYes: number;
  feeNo: number;
  orderYes: number;
  orderNo: number;
  announced: boolean;
  notified: boolean;
  pinned: boolean;
  ordered?: boolean;
  fee?: boolean;
};

/**
 * The product created event.
 * 
 * @template TypeProduct The product type.
 */
export class ProductListManager extends AbstractListManager<TypeProduct> {
  protected primaryKey: keyof TypeProduct = 'asin';
  protected sortFunction = (a: TypeProduct, b: TypeProduct) => {
    if (!a.pinned && b.pinned) return 1;
    if (a.pinned && !b.pinned) return -1;

    return b.timestamp - a.timestamp;
  }
}

/**
 * The hidden product type.
 * 
 * @property asin The ASIN.
 * @property timestamp The timestamp.
 * @returns {TypeHiddenProduct}
 */
export type TypeHiddenProduct = {
  asin: string;
  timestamp: number;
};

/**
 * The hidden product list manager.
 * 
 * @template TypeHiddenProduct The hidden product type.
 */
export class HiddenProductListManager extends AbstractListManager<TypeHiddenProduct> {
  protected primaryKey: keyof TypeHiddenProduct = 'asin';
  protected sortKey: keyof TypeHiddenProduct = 'timestamp';
  protected localStorageKey = 'hiddenProducts';
}

/**
 * The pinned product list manager.
 */
export class PinnedProductListManager extends AbstractListManager<TypeProduct> {
  protected primaryKey: keyof TypeProduct = 'asin';
  protected sortKey: keyof TypeProduct = 'timestamp';
  protected localStorageKey = 'pinnedProducts';
}


/**
 * The hidden product type.
 * 
 * @property asin The ASIN.
 * @property id The id.
 * @property timestamp The timestamp.
 * @returns {TypeNotificationItem}
 */
export type TypeNotificationItem = {
  asin: string;
  id: string;
  timestamp: number;
};

/**
 * The notification list manager.
 * 
 * @template TypeHiddenProduct The hidden product type.
 */
export class NotificationListManager extends AbstractListManager<TypeNotificationItem> {
  protected primaryKey: keyof TypeNotificationItem = 'id';
  protected sortKey: keyof TypeNotificationItem = 'timestamp';
  protected localStorageKey = 'notifications';
}

/**
 * Factory class for list manager.
 */
export class ListManagerFactory {
  /**
   * The instances.
   */
  private static instances: { [key: string]: AbstractListManager<any> } = {};

  /**
   * The instance name to type.
   */
  private static instanceNameToType: { [key: string]: typeof ProductListManager | typeof HiddenProductListManager | typeof PinnedProductListManager | typeof NotificationListManager } = {
    products: ProductListManager,
    hiddenProducts: HiddenProductListManager,
    notifications: NotificationListManager,
    pinnedProducts: PinnedProductListManager,
  };

  /**
   * Create a settings instance.
   * 
   * @param name - The name of the list manager.
   * @param logger - The logger instance.
   * @returns The list manager instance.
   * @throws Error if the list manager is not found.
   */
  static create<T>(name: string, logger: Logger): T {
    if (ListManagerFactory.instances[name]) {
      return ListManagerFactory.instances[name] as T;
    }

    if (ListManagerFactory.instanceNameToType[name]) {
      ListManagerFactory.instances[name] = new ListManagerFactory.instanceNameToType[name]({
          logger
      });
      return ListManagerFactory.instances[name] as T;
    }

    throw new Error(`Settings ${name} not found`);
  }
}