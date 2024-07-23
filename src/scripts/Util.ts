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
	 * Decode HTML entities in a string.
	 * 
	 * @param str - The string to decode HTML entities in.
	 * @returns The string with decoded HTML entities.
	 */
	decodeHtmlEntities(str: string) {
		return str.replace(/&([#]?(x)?[0-9a-z]+);/gi, (match) => {
			const element = document.createElement('textarea');
			element.innerHTML = match || '';
			return element.textContent || '';
		});
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
		// @ts-ignore - arguments is invalid in strict mode but honestly, i'm just logging this shit out
		log.debug("params", {
			key,
			existing
		});

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
		log.debug("params", {
			key,
			value
		});

		const data: Record<string, any> = {};
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

	/**
	 * Set a property in an object using dot notation.
	 * 
	 * @param obj - The object to set the property in.
	 * @param key - The key to set the property of.
	 * @param value - The value to set the property to.
	 * @param throwIfPrefixNotFound - Whether to throw an error if the prefix is not found.
	 */
	objPropertySetDeep(obj: any, key: string, value: any, throwIfPrefixNotFound = false) {
		const keys = key.split(".");
		let ref = obj;
		for (let i = 0; i < keys.length - 1; i++) {
			if (ref[keys[i]] === undefined) {
				if (throwIfPrefixNotFound) {
					throw new Error(`Prefix ${keys[i]} not found in ${key}`);
				}
				ref[keys[i]] = {};
			} else if (typeof ref[keys[i]] !== "object") {
				throw new Error(`Prefix ${keys[i]} in ${key} is not an object`);
			}
			ref = ref[keys[i]];
		}
		ref[keys[keys.length - 1]] = value;
	}

	/**
	 * Get a property in an object using dot notation.
	 * 
	 * @param obj - The object to get the property from.
	 * @param key - The key to get the property of.
	 * @param defaultValue - The default value to return if the property is not found.
	 * @returns The property of the object.
	 */
	objPropertyGetDeep(obj: any, key: string, defaultValue: any = undefined) {
		const keys = key.split(".");
		let ref = obj;
		for (let i = 0; i < keys.length - 1; i++) {
			if (ref[keys[i]] === undefined) {
				return defaultValue;
			} else if (typeof ref[keys[i]] !== "object") {
				throw new Error(`Prefix ${keys[i]} in ${key} is not an object`);
			}
			ref = ref[keys[i]];
		}
		return ref[keys[keys.length - 1]];
	}

	/**
	 * Create element with attributes.
	 * 
	 * @param elementSpec - The element specification.
	 * @returns The created element.
	 */
	createElement(elementSpec: ICreateElement) {
		const { tag, attributes, children } = elementSpec;
		const element = document.createElement(tag);
		for (const [key, value] of Object.entries(attributes)) {
			if (key === "class") {
				const classList = (value as string).split(" ");
				element.classList.add(...classList);
				continue;
			}
			if (typeof (element as any)[key] !== undefined) {
				(element as any)[key] = value;
				continue;
			}
			if (typeof value === "string") {
				element.setAttribute(key, value);
				continue;
			}
		}

		if (children) {
			for (const child of children) {
				if (child instanceof Element) {
					element.appendChild(child);
				} else {
					element.appendChild(this.createElement(child));
				}
			}
		}

		return element;
	}

	/**
	 * Compare two version strings using semantic versioning.
	 * 
	 * @param version1 - The first version string.
	 * @param version2 - The second version string.
	 * @returns -1 if version1 is less than version2, 1 if version1 is greater than version2, 0 if they are equal.
	 */
	versionCompare(version1: string, version2: string): number {
		const v1 = version1.split('.').map(Number);
		const v2 = version2.split('.').map(Number);

		for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
			const num1 = i < v1.length ? v1[i] : 0;
			const num2 = i < v2.length ? v2[i] : 0;

			if (num1 < num2) {
				return -1;
			} else if (num1 > num2) {
				return 1;
			}
		}

		return 0;
	}
}

interface ICreateElement {
	tag: string;
	attributes: { [key: string]: string | ((event: Event) => void | Promise<void>) };
	children?: (ICreateElement | Element)[];
}