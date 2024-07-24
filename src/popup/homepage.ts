//Reminder: This script is executed from the extension popup.
//          The console used is the browser console, not the inspector console.

import browser from "webextension-polyfill"; // Cross-Browser Compatibility
import { Logger } from "../scripts/Logger"; // Logging // Required for Settings
import { GlobalSettings, SettingsFactory, TypeGlobalSettings } from "../scripts/Settings"; // Settings


let manifest = browser.runtime.getManifest();
let appVersion = manifest.version;
let node= document.querySelectorAll("#version")[0];
if(node!=null){
	(node as HTMLElement).innerText = appVersion;
}


class VHGlobalSettings {
	protected log: Logger;
	protected settings!: GlobalSettings; // This will be set in the init function
	private currentTab:string = "tabs-1";
	

	/**
	 * The broadcast channel.
	 * 
	 * This channel is used to communicate between the service worker and the content script.
	 */
	protected broadcastChannel: BroadcastChannel = new BroadcastChannel("vh");


	constructor() {
		this.log = new Logger().scope("VHSettings");
		this.initSettings();
	}

	/**
	 * Initialize Settings
	 */
	protected async initSettings(): Promise<void> {
		//browser.runtime.onInstalled.addListener(this.onInstalled.bind(this));

		//Load the settings in this.settings
		this.settings = await SettingsFactory.create<GlobalSettings>("settings", this.log);
		
		//Add an event listener in case a setting change, to broadcast the change to the rest of the extension
		//ToDo: Is this required here as this code is already present in the serviceworker ?
		//      Wouldn't this create a double broadcast?
		this.settings.addEventListener("change", (event) => {
			const customEvent = event as CustomEvent<TypeGlobalSettings>;
			const settings = customEvent.detail;

			this.broadcastChannel.postMessage({
				type: "settings",
				settings: settings,
			});
		});

		this.init();//Once the settings are loaded, initialize the page
	}

	private setCB(key: string, value: boolean) {
		let keyE = CSS.escape(key);
	
		let cb = document.querySelector(`input[name='${keyE}']`);
		if(cb != null){
			(cb as HTMLInputElement).checked = value;
		}
	
		this.handleDynamicFields();
	}

	private getCB(key: string) {
		key = CSS.escape(key);
		let cb = document.querySelector(`input[name='${key}']`);
	
		return (cb as HTMLInputElement).checked == true;
	}

	private handleDynamicFields() {
		this.handleDependantChildCheckBoxes("hiddenTab.active", ["hiddenTab.remote"]);
	
		this.handleDependantChildCheckBoxes("general.displayFirstSeen", ["general.bookmark"]);
	
		this.handleDependantChildCheckBoxes("general.newItemNotification", ["general.displayNewItemNotifications"]);
	
		this.handleDependantChildCheckBoxes("general.displayNewItemNotifications", [
			"general.newItemNotificationImage",
			"general.newItemNotificationSound",
		]);
	}

	private handleDependantChildCheckBoxes(parentChk : string, arrChilds: string | any[] ) {
		let keyE = CSS.escape(parentChk);
		let elem = document.querySelector(`input[name='${keyE}']`);
		let checked = (elem as HTMLInputElement).checked;
	
		let keyF = null;
		for (let i = 0; i < arrChilds.length; i++) {
			keyF = CSS.escape(arrChilds[i]);
			elem = document.querySelector(`[name='${keyF}']`);
			(elem as HTMLInputElement).disabled = !checked;
		}
	}

	private drawDiscord() {
		//Show or hide the discord options
		let node = null;
		node = document.querySelector("#discordOptions")
		if(node!=null){
			(node as HTMLElement).style.display = this.settings.getProperty("discord.active") ? "block" : "none";
		}
	
		if (this.settings.getProperty("discord.active")) {
			let showLink = this.settings.getProperty("discord.guid") === null;
	
			node = document.querySelector("#discord-guid-link")
			if(node!=null){
				(node as HTMLElement).style.display = showLink ? "block" : "none";
			}
	
			node = document.querySelector("#discord-guid-unlink");
			if(node!=null){
				(node as HTMLElement).style.display = showLink ? "none" : "block";
			}
		}
	}

	private selectCurrentTab(firstRun = false) {
		//Hide all tabs
		document.querySelectorAll(".options").forEach(function (item) {
			(item as HTMLElement).style.display = "none";
		});
	
		if (!firstRun)
			document.querySelectorAll("#tabs > ul li").forEach(function (item) {
				item.classList.remove("active");
			});
	
		//Display the current tab
		let node = document.querySelector("#" + this.currentTab);
		if(node!=null){
			(node as HTMLElement).style.display = "flex";
		}
	}

	private manageCheckboxSetting(key : string, def:any = null) {
		const that = this;
		let val = def === null ? this.settings.getProperty(key) : def;
		this.setCB(key, val); //Initial setup
	
		let keyE = CSS.escape(key);
	
		//Clicking the label will check the checkbox
		let node=document.querySelector(`label[for='${keyE}']`);
		
		if(node!=null){
			(node as HTMLElement).onclick = async function (event:Event) {
				const target = event.target as HTMLElement;
		        if (target.nodeName == "INPUT"){
					 return false;
				}

				//Change the value
				const newValue = that.getCB(key);
				that.setCB(key, !newValue);
	
				const e = new Event("change");
				const element = document.querySelector(`input[name='${keyE}']`);
				if(element!=null){
					element.dispatchEvent(e);
				}
			}.bind(keyE);
		}
		
		node = document.querySelector(`input[name='${keyE}']`);
		if(node!=null){
			(node as HTMLElement).onchange = async () => {
				//Change in value
				this.handleDynamicFields();
				const newValue = this.getCB(key);
				this.settings.setProperty(key, newValue);
			};
		}
	}

	private async init() {
		const that = this;
		
		
		//Factory reset
		let node = null;
		node = document.getElementById("factoryReset");
		(node as HTMLElement).addEventListener("click", async () => {
			if (
				confirm(
					"SAVE YOUR UUID OR YOU WILL LOOSE YOUR REMOTE STORED ITEMS !\n\nReset all Vine Helper settings & local storage to default?"
				)
			) {
				await browser.storage.local.clear();
				alert(
					"All settings were deleted. RELOAD AMAZON VINE to restaure default settings.\nDO NOT EDIT OPTIONS before you reloaded an amazon vine page."
				);
			}
		});
		node = document.getElementById("hiddenItemReset");
		(node as HTMLElement).addEventListener("click", async () => {
			if (confirm("Delete all locally stored hidden items from Vine Helper?")) {
				browser.storage.local.set({ hiddenItems: [] });
				alert("Hidden items in local storage emptied.");
			}
		});
	
		//Bind the click event for the tabs
		document.querySelectorAll("#tabs > ul li").forEach(function (item) {
			(item as HTMLElement).onclick = function () {
				const currentTab = (this as HTMLElement).querySelector("a");
				const currentTabId = (currentTab as HTMLAnchorElement).href.split("#").pop();
				if(currentTabId != undefined){
					that.currentTab =currentTabId;
				}
				that.selectCurrentTab();
				(this as HTMLElement).classList.add("active");
			};
		});
		//Prevent links from being clickable
		document.querySelectorAll("#tabs > ul li a").forEach(function (item) {
			(item as HTMLElement).onclick = function (event) {
				let target = event.target;
				if ((target as HTMLAnchorElement).href == "#"){
					event.preventDefault();
				}
			};
		});
		this.selectCurrentTab(true);
		this.drawDiscord();
	
		node = document.getElementById("notificationsMonitor");
		(node as HTMLAnchorElement).href = browser.runtime.getURL("page/notifications.html");
		//###################
		//#### UI interaction
		let key = CSS.escape("discord.active");
		node = document.querySelector(`label[for='${key}'] input`);
		(node as HTMLElement).onclick = () => {
			setTimeout(() => this.drawDiscord(), 1);
		};
	
		//###################
		//## Load/save settings:
	
		//hiddenItemsCacheSize
		let select = document.getElementById("hiddenItemsCacheSize");
		if(select!=null){
			for (var i = 0; i < (select as HTMLSelectElement).options.length; i++) {
				if ((select as HTMLSelectElement).options[i].value == this.settings.getProperty("general.hiddenItemsCacheSize")) {
					(select as HTMLSelectElement).options[i].selected = true;
				}
			}
		}
		node = document.getElementById("hiddenItemsCacheSize");
		(node as HTMLElement).onchange = async () => {
			let node = document.getElementById("hiddenItemsCacheSize");
			await this.settings.setProperties({
				"general.hiddenItemsCacheSize": (node as HTMLInputElement).value
			});
			await browser.storage.local.set({ settings: appSettings });
		};
	
		//UUID:
		key = CSS.escape("general.uuid");
		node = document.querySelector(`#${key}`);
		(node as HTMLElement).onmouseenter = () => {
			let key = CSS.escape("general.uuid");
			(document.querySelector(`#${key}`) as HTMLInputElement).type = "text";
		};
		node = document.querySelector(`#${key}`);
		(node as HTMLElement).onmouseleave = () => {
			let key = CSS.escape("general.uuid");
			(document.querySelector(`#${key}`) as HTMLInputElement).type = "password";
		};
	
		(document.querySelector(`#${key}`) as HTMLInputElement).value = this.settings.getProperty("general.uuid");
	
		node = document.querySelector("#saveUUID");
		(node as HTMLElement).onclick = async () => {
			(document.querySelector("#saveUUID") as HTMLInputElement).disabled = true;
			let key = CSS.escape("general.uuid");
			//Post a fetch request to confirm if the UUID is valid
			let arrJSON = {
				api_version: 4,
				action: "validate_uuid",
				uuid: (document.querySelector("#" + key) as HTMLInputElement).value,
				country: "loremipsum",
			};
			let jsonArrURL = JSON.stringify(arrJSON);
	
			let url = "https://www.vinehelper.ovh/vinehelper.php" + "?data=" + jsonArrURL;
			await fetch(url)
				.then((response) => response.json())
				.then(async (serverResponse) => {
					if (serverResponse["ok"] == "ok") {
						await this.settings.setProperties({
							"general.uuid": serverResponse["uuid"]
						});
						
					} else {
						alert("Invalid UUID");
						key = CSS.escape("general.uuid");
						(document.querySelector(`#${key}`) as HTMLInputElement).value = this.settings.getProperty("general.uuid");
					}
				})
				.catch(function () {
					(error: any) => console.log(error);
				});
			(document.querySelector("#saveUUID") as HTMLInputElement).disabled = false;
		};
	
		node = document.querySelector("#saveGUID");
		(node as HTMLElement).onclick = async () => {
			(document.querySelector("#saveGUID") as HTMLInputElement).disabled = true;
			let key = CSS.escape("discord.guid");
			//Post a fetch request to the Brenda API from the AmazonVine Discord server
			//We want to check if the guid is valid.
			let url = "https://api.llamastories.com/brenda/user/" + (document.querySelector("#" + key) as HTMLInputElement).value;
			const response = await fetch(url, { method: "GET" });
			if (response.status == 200) {
				await this.settings.setProperties({
					"discord.guid": (document.querySelector(`#${key}`) as HTMLInputElement).value
				});
				
				(document.querySelector("#guid-txt") as HTMLElement).innerText = this.settings.getProperty("discord.guid");
				(document.querySelector("#discord-guid-link") as HTMLElement).style.display = "none";
				(document.querySelector("#discord-guid-unlink") as HTMLElement).style.display = "block";
			} else {
				(document.querySelector(`#${key}`) as HTMLInputElement).value = "";
				alert("invalid API Token.");
			}
			(document.querySelector("#saveGUID") as HTMLInputElement).disabled = false;
		};
		(document.querySelector("#unlinkGUID") as HTMLElement).onclick = async () => {
			await this.settings.setProperties({
				"discord.guid": null
			});
			
			(document.querySelector("#discord-guid-link") as HTMLElement).style.display = "block";
			(document.querySelector("#discord-guid-unlink") as HTMLElement).style.display = "none";
		};
	
		//Copy buttons
		(document.getElementById("copyBTC") as HTMLElement).addEventListener("click", () => {
			navigator.clipboard
				.writeText("bc1q0f82vk79u7hzxcrqe6q2levzvhdrqe72fm5w8z")
				.then(() => {
					// Alert the user that the text has been copied
					alert("BTC address copied to clipboard: ");
				})
				.catch((err) => {
					console.error("Failed to copy: ", err);
				});
		});
		(document.getElementById("copyETH") as HTMLElement).addEventListener("click", () => {
			navigator.clipboard
				.writeText("0xF5b68799b43C358E0A54482f0D8445DFBEA9BDF1")
				.then(() => {
					// Alert the user that the text has been copied
					alert("ETH address copied to clipboard");
				})
				.catch((err) => {
					console.error("Failed to copy: ", err);
				});
		});
	
		//Keybindings
		//ToDo: I think this is useless as those settings should now be initialized to a default value automatically
		if (this.settings.getProperty("keyBindings") == undefined) {
			await this.settings.setProperties({
				"keyBindings.nextPage": "n",
				"keyBindings.previousPage": "p",
				"keyBindings.RFYPage": "r",
				"keyBindings.AFAPage": "a",
				"keyBindings.AIPage" : "i",
				"keyBindings.hideAll" : "h",
				"keyBindings.showAll" : "s",
				"keyBindings.debug" : "d"
			});
		}
	
		(document.getElementById("keyBindingsNextPage") as HTMLInputElement).value = this.settings.getProperty("keyBindings.nextPage");
		(document.getElementById("keyBindingsPreviousPage") as HTMLInputElement).value = this.settings.getProperty("keyBindings.previousPage");
		(document.getElementById("keyBindingsRFYPage") as HTMLInputElement).value = this.settings.getProperty("keyBindings.RFYPage");
		(document.getElementById("keyBindingsAFAPage") as HTMLInputElement).value = this.settings.getProperty("keyBindings.AFAPage");
		(document.getElementById("keyBindingsAIPage") as HTMLInputElement).value = this.settings.getProperty("keyBindings.AIPage");
		(document.getElementById("keyBindingsHideAll") as HTMLInputElement).value = this.settings.getProperty("keyBindings.hideAll");
		(document.getElementById("keyBindingsShowAll") as HTMLInputElement).value = this.settings.getProperty("keyBindings.showAll");
		(document.getElementById("keyBindingsDebug") as HTMLInputElement).value = this.settings.getProperty("keyBindings.debug");
	
		node = document.getElementById("keyBindingsNextPage");
		(node as HTMLElement).addEventListener("change", async function () {
			if ((this as HTMLInputElement).value == ""){
				return false;
			}
			await that.settings.setProperties({
				"keyBindings.nextPage" : (this as HTMLInputElement).value
			});
			
		});
		node = document.getElementById("keyBindingsPreviousPage");
		(node as HTMLElement).addEventListener("change", async function () {
			if ((this as HTMLInputElement).value == ""){
				return false;
			}
	
			await that.settings.setProperties({
				"keyBindings.previousPage": (this as HTMLInputElement).value
			});
		});
		node = document.getElementById("keyBindingsRFYPage");
		(node as HTMLElement).addEventListener("change", async function () {
			if ((this as HTMLInputElement).value == ""){
				return false;
			}
	
			await that.settings.setProperties({
				"keyBindings.RFYPage": (this as HTMLInputElement).value
			});
		});
		node = document.getElementById("keyBindingsAFAPage");
		(node as HTMLElement).addEventListener("change", async function () {
			if ((this as HTMLInputElement).value == ""){
				return false;
			}
	
			await that.settings.setProperties({
				"keyBindings.AFAPage": (this as HTMLInputElement).value
			});
		});
		node = document.getElementById("keyBindingsAIPage");
		(node as HTMLElement).addEventListener("change",async function () {
			if ((this as HTMLInputElement).value == ""){
				return false;
			}
			await that.settings.setProperties({
				"keyBindings.AIPage": (this as HTMLInputElement).value
			});
		});
		node = document.getElementById("keyBindingsHideAll");
		(node as HTMLElement).addEventListener("change",async function () {
			if ((this as HTMLInputElement).value == ""){
				return false;
			}
	
			await that.settings.setProperties({
				"keyBindings.hideAll": (this as HTMLInputElement).value
			});
		});
		node = document.getElementById("keyBindingsShowAll");
		(node as HTMLElement).addEventListener("change",async function () {
			if ((this as HTMLInputElement).value == ""){
				return false;
			}
	
			await that.settings.setProperties({
				"keyBindings.showAll":(this as HTMLInputElement).value
			});
		});
		node = document.getElementById("keyBindingsDebug");
		(node as HTMLElement).addEventListener("change",async function () {
			if ((this as HTMLInputElement).value == ""){
				return false;
			}
	
			await that.settings.setProperties({
				"keyBindings.debug":(this as HTMLInputElement).value
			});
		});
	
		//Keywords
	
		let highlightSetting = this.settings.getProperty("general.highlightKeywords");
		let hideSetting = this.settings.getProperty("general.hideKeywords");
		let arrHighlight =
		highlightSetting == undefined ? "" : highlightSetting.join(", ");
		node = document.getElementById("generalhighlightKeywords");
		(node as HTMLInputElement).value = arrHighlight;
		
		let arrHide = hideSetting == undefined ? "" : hideSetting.join(", ");
		node = document.getElementById("generalhideKeywords");
		(node as HTMLInputElement).value = arrHide;
	
		node = document.getElementById("generalhighlightKeywords");
		(node as HTMLElement).addEventListener("change",async () => {
			let arr: any = [];
			let node = null;
			node =document.getElementById("generalhighlightKeywords"); 
			arr = (node as HTMLInputElement)
				.value.split(",")
				.map((item) => item.trim());
			if (arr.length == 1 && arr[0] == "") arr = [];
			await this.settings.setProperties({
				"general.highlightKeywords": arr
			});
		});
		node = document.getElementById("generalhideKeywords");
		(node as HTMLElement).addEventListener("change",async () => {
			let arr: any = [];
			let node = null;
			node = document.getElementById("generalhideKeywords");
			arr = (node as HTMLInputElement)
				.value.split(",")
				.map((item) => item.trim());
			if (arr.length == 1 && arr[0] == "") arr = [];
			await this.settings.setProperties({
				"general.hideKeywords" :arr
			});
		});
		//Manage checkboxes load and save
		this.manageCheckboxSetting("general.topPagination");
		this.manageCheckboxSetting("general.versionInfoPopup", false);
		this.manageCheckboxSetting("general.GDPRPopup", false);
		this.manageCheckboxSetting("general.displayETV");
		this.manageCheckboxSetting("general.displayVariantIcon");
		this.manageCheckboxSetting("general.displayFirstSeen");
		this.manageCheckboxSetting("general.bookmark");
		this.manageCheckboxSetting("general.newItemNotification");
		this.manageCheckboxSetting("general.displayNewItemNotifications");
		this.manageCheckboxSetting("general.newItemNotificationSound");
		this.manageCheckboxSetting("general.newItemMonitorNotificationSound");
		this.manageCheckboxSetting("general.newItemNotificationImage");
		this.manageCheckboxSetting("keyBindings.active");
		this.manageCheckboxSetting("hiddenTab.active");
		this.manageCheckboxSetting("hiddenTab.remote");
		this.manageCheckboxSetting("discord.active"); //Handled manually
		this.manageCheckboxSetting("unavailableTab.active");
		this.manageCheckboxSetting("unavailableTab.compactToolbar");
	
		this.manageCheckboxSetting("thorvarium.mobileios");
		this.manageCheckboxSetting("thorvarium.mobileandroid");
		this.manageCheckboxSetting("thorvarium.smallItems");
		this.manageCheckboxSetting("thorvarium.removeHeader");
		this.manageCheckboxSetting("thorvarium.removeFooter");
		this.manageCheckboxSetting("thorvarium.removeAssociateHeader");
		this.manageCheckboxSetting("thorvarium.moreDescriptionText");
		this.manageCheckboxSetting("thorvarium.darktheme");
		this.manageCheckboxSetting("thorvarium.ETVModalOnTop");
		this.manageCheckboxSetting("thorvarium.categoriesWithEmojis");
		this.manageCheckboxSetting("thorvarium.paginationOnTop");
		this.manageCheckboxSetting("thorvarium.collapsableCategories");
		this.manageCheckboxSetting("thorvarium.stripedCategories");
		this.manageCheckboxSetting("thorvarium.limitedQuantityIcon");
		this.manageCheckboxSetting("thorvarium.RFYAFAAITabs");
	}
}
new VHGlobalSettings();




