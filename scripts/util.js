class Util {
	arrayUnique(arr) {
		return arr.filter((value, index, self) => self.indexOf(value) === index);
	}

	async getLocalStorage(key, existing) {
		if (Array.isArray(key)) {
			return Promise.all(key.map((key, index) => this.getLocalStorage(key, existing?.[index] || {})));
		}
		existing = existing || {};

		const data = await chrome.storage.local.get(key);

		return util.deepMerge(existing, data[key] || {});
	}

	getType(obj) {
		return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
	}

	objMerge(clone, obj) {
		for (let [key, value] of Object.entries(obj)) {
			let type = this.getType(value);
			if (clone[key] !== undefined && this.getType(clone[key]) === type && ["array", "object"].includes(type)) {
				clone[key] = this.deepMerge(clone[key], value);
			} else {
				clone[key] = structuredClone(value);
			}
		}
	}

	deepMerge(...objs) {
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
}
