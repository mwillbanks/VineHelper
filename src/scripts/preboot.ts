const startTime = Date.now();

if (typeof browser === "undefined") {
	var browser = chrome;
}

//Extension settings
var appSettings = {};
var arrHidden = {};
var arrDebug = [];
let debugMessage = "";

var vineDomain = null;
var vineCountry = null;
var vineLocale = null;
var vineCurrency = null;
var vineQueue = null;
var vineQueueAbbr = null;
var vineSearch = false;
var vineBrowsingListing = false;
var uuid = null;

var appVersion = 0;
var ultraviner = false; //If Ultravine is detected, Vine Helper will deactivate itself to avoid conflicts.

var Tpl = new Template();
var TplMgr = new TemplateMgr();
var DialogMgr = new ModalMgr();
var Notifications = new ScreenNotifier();
var HiddenList = new HiddenListMgr();

async function loadStyleSheet(path) {
	prom = await Tpl.loadFile(path);
	let content = Tpl.render(prom);
	$("head").append("<style type='text/css'>" + content + "</style>");
}

//Loading the settings from the local storage
async function getSettings() {
	//v2.3.3
	if (appSettings.general.hideKeywords == undefined) {
		appSettings.general.hideKeywords = [];
		saveSettings();
	}
	if (appSettings.general.highlightKeywords == undefined) {
		appSettings.general.highlightKeywords = [];
		saveSettings();
	}

	//Load Thorvarium stylesheets
	if (appSettings.thorvarium.mobileios) loadStyleSheet("node_modules/vine-styling/mobile/ios-with-bugfix.css");

	if (appSettings.thorvarium.mobileandroid) loadStyleSheet("node_modules/vine-styling/mobile/mobile.css");

	if (appSettings.thorvarium.smallItems) loadStyleSheet("node_modules/vine-styling/desktop/small-items.css");

	if (appSettings.thorvarium.removeHeader) loadStyleSheet("node_modules/vine-styling/desktop/remove-header.css");

	if (appSettings.thorvarium.removeFooter) loadStyleSheet("node_modules/vine-styling/desktop/remove-footer.css");

	if (appSettings.thorvarium.removeAssociateHeader)
		loadStyleSheet("node_modules/vine-styling/desktop/remove-associate-header.css");

	if (appSettings.thorvarium.moreDescriptionText)
		loadStyleSheet("node_modules/vine-styling/desktop/more-description-text.css");

	if (appSettings.thorvarium.darktheme) loadStyleSheet("node_modules/vine-styling/desktop/dark-theme.css");

	if (appSettings.thorvarium.ETVModalOnTop) loadStyleSheet("node_modules/vine-styling/desktop/etv-modal-on-top.css");

	if (appSettings.thorvarium.paginationOnTop)
		loadStyleSheet("node_modules/vine-styling/desktop/pagination-on-top.css");

	if (appSettings.thorvarium.collapsableCategories)
		loadStyleSheet("node_modules/vine-styling/desktop/collapsable-categories.css");

	if (appSettings.thorvarium.stripedCategories)
		loadStyleSheet("node_modules/vine-styling/desktop/striped-categories.css");

	if (appSettings.thorvarium.limitedQuantityIcon)
		loadStyleSheet("node_modules/vine-styling/desktop/limited-quantity-icon.css");

	if (appSettings.thorvarium.RFYAFAAITabs) loadStyleSheet("node_modules/vine-styling/desktop/rfy-afa-ai-tabs.css");

	showRuntime("BOOT: Thorvarium stylesheets injected");

	//Figure out what domain the extension is working on
	//De-activate the unavailableTab (and the voting system) for all non-.ca domains.
	let currentUrl = window.location.href;
	regex = /^.+?amazon\.([a-z.]+).*\/vine\/.*$/;
	arrMatches = currentUrl.match(regex);
	vineDomain = arrMatches[1];
	vineCountry = vineDomain.split(".").pop();

	// Load the country specific stylesheet
	if (appSettings.thorvarium.categoriesWithEmojis)
		// The default stylesheet is for the US
		var emojiList = "categories-with-emojis";
	// For all other countries, append the country code to the stylesheet
	if (vineCountry != "com") emojiList += "-" + vineCountry.toUpperCase();

	loadStyleSheet("node_modules/vine-styling/desktop/" + emojiList + ".css");

	showRuntime("BOOT: Thorvarium country-specific stylesheets injected");

	//If the domain is not Canada, UK or France, de-activate the voting system/unavailable tab
	if (["ca", "co.uk", "fr"].indexOf(vineDomain) == -1) {
		appSettings.unavailableTab.votingToolbar = false;
		appSettings.unavailableTab.consensusDiscard = false;
		appSettings.unavailableTab.selfDiscard = false;
	}

	//If the domain if not from outside the countries supported by the discord API, disable discord
	if (["ca", "com", "co.uk"].indexOf(vineDomain) == -1) {
		appSettings.discord.active = false;
	}

	//Determine if we are browsing a queue
	regex = /^.+?amazon\..+\/vine\/vine-items(?:\?(queue|search)=(.+?))?(?:[#&].*)?$/;
	arrMatches = currentUrl.match(regex);
	vineQueue = null;
	if (arrMatches != null) {
		vineBrowsingListing = true;
		if (arrMatches[1] == "queue" && arrMatches[2] != undefined) {
			vineQueue = arrMatches[2];
		} else if (arrMatches[1] == undefined) {
			vineQueue = "last_chance"; //Default AFA
		} else {
			vineQueue = null; //Could be a ?search, (but not a &search).
		}
	}

	//Determine if we are currently searching for an item
	regex = /^.+?amazon\..+\/vine\/vine-items(?:.*?)(?:[?&]search=(.+?))(?:[#&].*?)?$/;
	arrMatches = currentUrl.match(regex);
	if (arrMatches != null) {
		if (arrMatches[1] == undefined) {
			vineSearch = false;
		} else {
			vineSearch = true;
			vineQueue = null;
		}
	}

	let arrQueues = { potluck: "RFY", last_chance: "AFA", encore: "AI" };
	if (vineQueue != null) vineQueueAbbr = arrQueues[vineQueue];

	//Generate a UUID for the user
	if (appSettings.general.uuid == undefined || appSettings.general.uuid == null) {
		//Request a new UUID from the server
		let arrJSON = {
			api_version: 4,
			action: "get_uuid",
			country: vineCountry,
		};
		let jsonArrURL = JSON.stringify(arrJSON);

		//Post an AJAX request to the 3rd party server, passing along the JSON array of all the products on the page
		let url = "https://vinehelper.ovh/vinehelper.php" + "?data=" + jsonArrURL;
		fetch(url)
			.then((response) => response.json())
			.then(function (serverResponse) {
				if (serverResponse["ok"] == "ok") {
					appSettings.general.uuid = serverResponse["uuid"];
					uuid = appSettings.general.uuid;
					saveSettings();
				}
			})
			.catch(function () {
				(error) => console.log(error);
			});
	}
	uuid = appSettings.general.uuid;

	showRuntime("PRE: Settings loaded");
}
showRuntime("PRE: Begining to load settings");

//Do not run the extension if ultraviner is running
regex = /^.+?amazon\..+\/vine\/.*ultraviner.*?$/;
if (!regex.test(window.location.href)) {
	getSettings(); //First call to launch the extension.
} else {
	ultraviner = true;
	console.log("VineHelper detected UltraViner. Disabling VineHelper on this page.");
}

function getRunTime() {
	return Date.now() - startTime;
}

async function getRunTimeJSON() {
	try {
		await generateStorageUsageForDebug();
	} catch (error) {
		console.error("Error generating runtime json");
	} finally {
		return JSON.stringify(arrDebug, null, 2).replaceAll("\n", "<br/>\n");
	}
}

function bytesToSize(bytes, decimals = 2) {
	if (!Number(bytes)) {
		return "0 Bytes";
	}

	const kbToBytes = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

	const index = Math.floor(Math.log(bytes) / Math.log(kbToBytes));

	return `${parseFloat((bytes / Math.pow(kbToBytes, index)).toFixed(dm))} ${sizes[index]}`;
}

async function generateStorageUsageForDebug() {
	try {
		const items = await getStorageItems();
		for (let key in items) {
			try {
				let itemCount = "";
				const keyLength = await getStorageKeyLength(key);
				const bytesUsed = await getStorageKeySizeinBytes(key);

				if (key != "settings") {
					itemCount = `representing ${keyLength} items`;
				}
				showRuntime(`Storage used by ${key}: ${bytesToSize(bytesUsed)} ${itemCount}`);
			} catch (error) {
				console.error(`Error retrieving storage data for ${key}: ${error.message}`);
			}
		}
	} catch (error) {
		console.error("Error fetching storage items:", error.message);
	}
}

// Helper function to get storage items as a promise
function getStorageItems() {
	return new Promise((resolve, reject) => {
		browser.storage.local.get(null, (items) => {
			if (browser.runtime.lastError) {
				reject(new Error(browser.runtime.lastError.message));
			} else {
				resolve(items);
			}
		});
	});
}

function getStorageKeySizeinBytes(key) {
	return new Promise((resolve, reject) => {
		browser.storage.local.get(key, function (items) {
			if (browser.runtime.lastError) {
				reject(new Error(browser.runtime.lastError.message));
			} else {
				const storageSize = JSON.stringify(items[key]).length;
				resolve(storageSize);
			}
		});
	});
}

function getStorageKeyLength(key) {
	return new Promise((resolve, reject) => {
		browser.storage.local.get(key, function (items) {
			if (browser.runtime.lastError) {
				reject(new Error(browser.runtime.lastError.message));
			} else {
				const itemSize = items[key].length;
				resolve(itemSize);
			}
		});
	});
}

function getStorageSizeFull() {
	return new Promise((resolve, reject) => {
		browser.storage.local.get(function (items) {
			if (browser.runtime.lastError) {
				reject(new Error(browser.runtime.lastError.message));
			} else {
				const storageSize = JSON.stringify(items).length;
				resolve(storageSize);
			}
		});
	});
}