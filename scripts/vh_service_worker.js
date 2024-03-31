const DEBUG_MODE = false;
var appSettings = [];
var vineCountry = null;
var vineHelperKeepAlive = null;
var VH_FEED_DISABLED = false;
var VH_FEED_INTERVAL = 15000;
var VH_FEED_TIMEOUT_ID = null;

if (typeof browser === "undefined") {
	var browser = chrome;
}

if (typeof chrome !== "undefined") {
	chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
		if (!tab.url) return;

		const enabled = /http(s)?:\/\/[^.]*.amazon.[^/]*\/vine/i.test(tab.url);
		await chrome.sidePanel.setOptions({
			tabId,
			path: "pages/sidepanel.html",
			enabled,
		});
	});

	chrome.runtime.onInstalled.addListener(() => {
		chrome?.contextMenus?.create({
			id: "openSidePanel",
			title: "Open side panel",
			contexts: ["all"],
		});
	});

	chrome.contextMenus?.onClicked?.addListener((info, tab) => {
		if (info.menuItemId === "openSidePanel") {
			chrome.sidePanel.open({ windowId: tab.windowId });
			isSidePanelOpen = true;
		}
	});
}

//First, we need for the preboot.js file to send us the country of Vine the extension is running onto.
//Until we have that data, the service worker will standown and retry on the next pass.
browser.runtime.onMessage.addListener((data, sender, sendResponse) => {
	if (data.type == "vineCountry") {
		// console.log("Received country from preboot.js: " + data.vineCountry);
		vineCountry = data.vineCountry;

		//Passing the country to the Monitor tab
		sendMessageToAllTabs({ type: "vineCountry", domain: data.vineCountry }, "Vine Country");
	}
	if (data.type == "keepAlive") {
		//console.log("Received keep alive.");
		sendResponse({ success: true });
	}
	if (data.type === "feed") {
		if (data.action === "start") {
			VH_FEED_DISABLED = false;
			checkNewItems();
		} else if (data.action === "stop") {
			VH_FEED_DISABLED = true;
		}
	}
});

//Load the settings, if no settings, try again in 10 sec
async function init() {
	const data = await chrome.storage.local.get("settings");
	if (data == null || Object.keys(data).length === 0) {
		setTimeout(function () {
			init();
		}, 10000);
		return; //Settings have not been initialized yet.
	} else {
		Object.assign(appSettings, data.settings);
	}

	if (appSettings.general.newItemNotification) {
		checkNewItems();
	}
}

init();

const decodeHtmlEntities = (str) => str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
async function checkNewItems() {
	clearTimeout(VH_FEED_TIMEOUT_ID);
	if (VH_FEED_DISABLED) {
		return;
	}

	if (vineCountry == null) {
		VH_FEED_TIMEOUT_ID = setTimeout(checkNewItems, VH_FEED_INTERVAL);
		return;
	}

	if (!vineHelperKeepAlive) {
		vineHelperKeepAlive = setInterval(async () => {
			sendMessageToAllTabs({ type: "keepAlive" }, "Keep Alive");
		}, 25000);
	}

	if (appSettings == undefined || !appSettings.general.newItemNotification) {
		VH_FEED_TIMEOUT_ID = setTimeout(checkNewItems, VH_FEED_INTERVAL);
		return; //Not setup to check for notifications. Will try again in 30 secs.
	}

	sendMessageToAllTabs({ type: "newItemCheck" }, "Loading wheel");

	//Post an AJAX request to the 3rd party server, passing along the JSON array of all the products on the page
	const url =
		"https://vinehelper.ovh/vineHelperLatest.php" +
		"?data=" +
		JSON.stringify({
			api_version: 4,
			country: vineCountry,
			orderby: "date",
			limit: 50,
		});
	const response = await fetch(url);
	let { products } = await response.json();

	products = (products || []).reduce((acc, product, i) => {
		if (!product.img_url) return acc;
		if (!product.title) return acc;

		product.title = decodeHtmlEntities(product.title);

		if (typeof product.timestamp === "number") {
			product.date = new Date(product.timestamp * 1000).getTime();
		} else {
			const [date, time] = product.date.split(" ");
			product.date = new Date(date + "T" + time + "Z").getTime();
		}
		product.search = product.title.replace(/^([a-zA-Z0-9\s',]{0,40})[\s]+.*$/, "$1");
		sendMessageToAllTabs(
			{
				index: i,
				type: "newItem",
				domain: vineCountry,
				...product,
			},
			"notification"
		);
		acc.push({
			...product,
		});
		return acc;
	}, []);

	// Broadcast the item to the vineHelperSidePanel channel
	chrome.runtime.sendMessage({
		name: "vinehelperSidePanel",
		type: "newProducts",
		domain: vineCountry,
		products,
	});

	VH_FEED_TIMEOUT_ID = setTimeout(checkNewItems, VH_FEED_INTERVAL);
}

async function sendMessageToAllTabs(data, debugInfo) {
	await chrome.tabs.query(
		{
			/* No criteria */
		},
		async function (tabs) {
			await tabs.forEach(async (tab) => {
				//console.log("(" + debugInfo + ") Sending to tab id " + tab.id);
				await chrome.tabs.sendMessage(tab.id, data, (response) => {
					if (browser.runtime.lastError) {
						//console.log(browser.runtime.lastError.message);
						return;
					}
					if (!response) {
						// console.log("Failed");
						return;
					}
				});
			});
		}
	);
}
