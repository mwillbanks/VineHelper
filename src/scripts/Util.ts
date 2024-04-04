import browser from "webextension-polyfill";
import { Logger } from "./Logger";

/**
 * Utility class for common functions.
 */
export class Util {
	logger: Logger;

	/**
	 * @param logger - The logger instance.
	 */
	constructor({ logger }: { logger: Logger }) {
		this.logger = logger.scope("util");
	}

	/**
	 * Remove duplicates from an array.
	 * 
	 * @param arr - The array to remove duplicates from.
	 * @returns The array without duplicates.
	 */
	arrayUnique(arr: any[]) {
		return arr.filter((value, index, self) => self.indexOf(value) === index);
	}

	/**
	 * Get the value of a key from local storage.
	 * 
	 * @param key - The key to get the value of.
	 * @param existing - The existing value to merge with the value from local storage.
	 * @returns The value of the key from local storage.
	 */
	async getLocalStorage<T>(key: string, existing?: T): Promise<T> {
		const log = this.logger.scope("getLocalStorage");
		log.debug("params", arguments);

		const data = await browser.storage.local.get(key);
		log.debug(`get:${key}`, { data });

		const result = this.deepMerge(existing, data[key] || {});
		log.debug(`get:${key}:result`, { data });

		return result;
	}

	/**
	 * Set the value of a key in local storage.
	 * 
	 * @param key - The key to set the value of.
	 * @param value - The value to set.
	 */
	async setLocalStorage(key: string, value: any) {
		const log = this.logger.scope("setLocalStorage");
		log.debug("params", arguments);

		const data : Record<string, any> = {};
		data[key] = value;
		log.debug(`set:${key}`, { data });

		await browser.storage.local.set(data);
		log.debug(`set:${key}:result`, { data });
	}

	/**
	 * Remove a key from local storage.
	 * 
	 * @param key - The key to remove.
	 * @returns The value of the key that was removed.
	 */
	getType(obj: any) {
		return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
	}

	/**
	 * Deep merge two objects.
	 * 
	 * @param clone - The object to merge into.
	 * @param obj - The object to merge.
	 * @returns The merged object.
	 */
	objMerge(clone: any, obj: any) {
		for (let [key, value] of Object.entries(obj)) {
			let type = this.getType(value);
			if (clone[key] !== undefined && this.getType(clone[key]) === type && ["array", "object"].includes(type)) {
				clone[key] = this.deepMerge(clone[key], value);
			} else {
				clone[key] = structuredClone(value);
			}
		}
	}

	/**
	 * Deep merge multiple objects.
	 * 
	 * @param objs - The objects to merge.
	 * @returns The merged object.
	 */
	deepMerge(...objs: any[]) {
		let clone = structuredClone(objs.shift());
		for (let obj of objs) {
			let type = this.getType(obj);
			if (this.getType(clone) !== type) {
				clone = structuredClone(obj);
				continue;
			}
			if (type === "array") {
				clone = this.arrayUnique([...clone, ...structuredClone(obj)]);
			} else if (type === "object") {
				this.objMerge(clone, obj);
			} else {
				clone = obj;
			}
		}

		return clone;
	}

	/**
	 * Deep freeze an object.
	 * 
	 * @param obj - The object to freeze.
	 * @returns The frozen object.
	 */
	deepFreeze(obj: any) {
		Object.freeze(obj);
	
		for (const key of Object.getOwnPropertyNames(obj)) {
			const value = obj[key];
	
			if (typeof value === "object" && !Object.isFrozen(value)) {
				this.deepFreeze(value);
			}
		}
	
		return obj;
	}
}
