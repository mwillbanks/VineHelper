if (typeof browser === "undefined") {
	var browser = chrome;
}

class MessageBus {
    constructor() {
        this.listeners = {
            storageChanged: [],
            message: [],
        };

        browser.storage.onChanged.addListener((changes, namespace) => {
            this.storageChanged(changes, namespace);
        });

        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.notify(message, sender, sendResponse);
        });
    }

    storageChanged(changes, area) {
        if (area === "local") {
            this.notify({ type: "storageChanged", changes });
        }
    }

    addListener(listenerType, listener) {
        this.listeners[listenerType].push(listener);
    }

    removeListener(listenerType, listener) {
        this.listeners = this.listeners[listenerType].filter(l => l !== listener);
    }

    notify(listenerType, message, sender, sendResponse) {
        this.listeners[listenerType].forEach(listener => listener(message, sender, sendResponse));
    }

    vhPoll() {
        this.notify("vhPoll");
    }

    productAnnounce(product) {
        this.notify("productAnnounce", product);
    }

    productNew(product) {
        this.notify("productNew", product);
    }

    productPin(product) {
        this.notify("productPin", product);
    }

    productUnpin(product) {
        this.notify("productUnpin", product);
    }

    productShow(product) {
        this.notify("productShow", product);
    }

    productHide(product) {
        this.notify("productHide", product);
    }

    productEtv(product) {
        this.notify("productEtv", product);
    }
}