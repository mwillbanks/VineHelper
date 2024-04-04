class HiddenListMgr {
	constructor() {
		this.broadcast = new BroadcastChannel("vine_helper");
		this.arrHidden = {};
		this.arrChanges = {};
		this.listLoaded = false;

		this.init();
	}

	async init() {
		showRuntime("HIDDENMGR: Loading list");
		await this.loadFromLocalStorage();

		this.broadcast.onmessage = function (ev) {
			const type = ev.data?.type;

			if (type == "hideItem") {
				showRuntime("Broadcast received: hide item " + ev.data.asin);
				HiddenList.addItem(ev.data.asin, false, false);
			}

			if (type == "showItem") {
				showRuntime("Broadcast received: show item " + ev.data.asin);
				HiddenList.removeItem(ev.data.asin, false, false);
			}
		};
	}

	async loadFromLocalStorage() {
		const data = await browser.storage.local.get("hiddenItems");

		//Load hidden items
		if (Object.keys(data).length === 0 || typeof data.hiddenItems !== "object") {
			await browser.storage.local.set({ hiddenItems: {} });
		} else if (Array.isArray(data.hiddenItems)) {
			this.arrHidden = data.hiddenItems.reduce((acc, item) => {
				acc[item.asin] = new Date(item.date).getTime();
				return acc;
			}, this.arrHidden);
			await browser.storage.local.set({ hiddenItems: this.arrHidden });
		} else {
			this.arrHidden = { ...data.hiddenItems, ...this.arrHidden };
		}

		this.listLoaded = true;
		showRuntime("HIDDENMGR: List loaded.");
	}

	async removeItem(asin, save = true, broadcast = true) {
		if (save) await this.loadFromLocalStorage(); //Load the list in case it was altered in a different tab
		delete this.arrHidden?.[asin];
		//The server may not be in sync with the local list, and will deal with duplicate.
		this.updateArrChange({ asin: asin, hidden: false });

		if (save) this.saveList();

		//Broadcast the change to other tabs
		if (broadcast) {
			this.broadcast.postMessage({ type: "showItem", asin: asin });
		}
	}

	async addItem(asin, save = true, broadcast = true) {
		if (save) await this.loadFromLocalStorage(); //Load the list in case it was altered in a different tab

		this.arrHidden[asin] = Date.now();

		//The server may not be in sync with the local list, and will deal with duplicate.
		this.updateArrChange({ asin: asin, hidden: true });

		if (save) this.saveList();

		//Broadcast the change to other tabs
		if (broadcast) {
			this.broadcast.postMessage({ type: "hideItem", asin: asin });
		}
	}

	async saveList() {
		await browser.storage.local.set({ hiddenItems: this.arrHidden }, () => {
			if (browser.runtime.lastError) {
				const error = browser.runtime.lastError;
				if (error.message === "QUOTA_BYTES quota exceeded") {
					alert(`Vine Helper local storage quota exceeded! Hidden items will be trimmed to make space.`);
					this.garbageCollection();
				} else {
					alert(
						`Vine Helper encountered an error while trying to save your hidden items. Please report the following details: ${e.name}, ${e.message}`
					);
					return;
				}
			}
		});

		if (appSettings.hiddenTab.remote) {
			this.notifyServerOfHiddenItem();
			this.arrChanges = {};
		}
	}

	isHidden(asin) {
		if (asin == undefined) throw new Exception("Asin not defined");

		return !!this.arrHidden?.[asin];
	}

	isChange(asin) {
		return typeof this.arrChanges[asin] !== "undefined";
	}

	updateArrChange(obj) {
		this.arrChanges[obj.asin] = obj.hidden;
	}

	/**
	 * Send new items on the server to be added or removed from the hidden list.
	 * @param [{"asin": "abc", "hidden": true}, ...] arr
	 */
	notifyServerOfHiddenItem() {
		let arrJSON = {
			api_version: 4,
			country: vineCountry,
			action: "save_hidden_list",
			uuid: appSettings.general.uuid,
			arr: Object.entries(this.arrChanges).map(([asin, hidden]) => ({ asin, hidden })),
		};
		let jsonArrURL = JSON.stringify(arrJSON);

		showRuntime("Saving hidden item(s) remotely...");

		//Post an AJAX request to the 3rd party server, passing along the JSON array of all the products on the page
		fetch("https://www.vinehelper.ovh/vinehelper.php" + "?data=" + jsonArrURL);
	}

	/**
	 * Find the index of the first element in the array that has a timestamp greater than or equal to expiredTime using binary search.
	 * @param {Array} arr The array to search [[asin, timestamp]] sorted by timestamp in ascending order.
	 * @param {Number} expiredTime The timestamp to compare against.
	 * @returns {Number} The index of the first element in the array that has a timestamp greater than or equal to expiredTime.
	 */
	findFirstIndexPastExpired(arr, expiredTime) {
		let left = 0;
		let right = arr.length - 1;
		let result = -1; // Assume no valid result initially

		while (left <= right) {
			let mid = Math.floor((left + right) / 2);
			if (arr[mid][1] >= expiredTime) {
				result = mid;
				right = mid - 1;
			} else {
				left = mid + 1;
			}
		}

		return result;
	}

	async garbageCollection() {
		if (!Object.keys(this.arrHidden).length) {
			return false;
		}
		if (isNaN(appSettings.general.hiddenItemsCacheSize)) {
			return false;
		}
		if (appSettings.general.hiddenItemsCacheSize < 2 || appSettings.general.hiddenItemsCacheSize > 9) {
			return false;
		}

		// Convert the object to an array of key-value pairs and sort it by date
		const entries = Object.entries(this.arrHidden);
		entries.sort((a, b) => a[1] - b[1]);

		//Delete older items if the storage space is exceeded.
		let bytes = await getStorageSizeFull();
		const storageLimit = appSettings.general.hiddenItemsCacheSize * 1048576; // 9MB
		const deletionThreshold = (appSettings.general.hiddenItemsCacheSize - 1) * 1048576; // 8MB
		if (bytes > storageLimit) {
			let note = new ScreenNotification();
			note.title = "Local storage quota exceeded!";
			note.lifespan = 60;
			note.content = `You've hidden so many items that your quota in the local storage has exceeded ${bytesToSize(
				storageLimit
			)}. To prevent issues, ~1MB of the oldest items are being deleted...`;
			await Notifications.pushNotification(note);

			//Give some breathing room for the notification to be displayed.
			await new Promise((r) => setTimeout(r, 500));

			// Estimate of the size of each item in bytes which calculates the number of items to delete
			const itemBytesEstimate = 48;
			const excessBytes = bytes - deletionThreshold;
			const itemsToDelete = Math.min(Math.ceil(excessBytes / itemBytesEstimate), entries.length);
			entries.splice(0, itemsToDelete);
			this.arrHidden = Object.fromEntries(entries);
			await browser.storage.local.set({
				hiddenItems: this.arrHidden,
			});

			note.title = "Local storage quota fixed!";
			note.lifespan = 60;
			note.content = `GC done, ${itemsToDelete} items have been deleted. Some of these items may re-appear in your listing.`;
			await Notifications.pushNotification(note);
		}

		// Delete items older than 90 days
		const originalLength = entries.length;
		const expiredTime = Date.now() - 1000 * 60 * 60 * 24 * 90; // 90 days in milliseconds
		const index = this.findFirstIndexPastExpired(entries, expiredTime);
		if (index !== -1) {
			entries.splice(0, index);
			this.arrHidden = Object.fromEntries(entries);
		}

		if (entries.length != originalLength) {
			this.saveList();
		}
	}
}
