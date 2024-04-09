import { Logger } from "./Logger";
import { Util } from "./Util";

/**
 * Shadow DOM class.
 * 
 * This class is responsible for creating a shadow DOM container and root.
 */
class ShadowDOM {
  protected shadowContainer!: HTMLElement;
  protected shadowRoot!: ShadowRoot;
  protected logger: Logger;
  protected util: Util;

  /**
   * Creates an instance of ShadowDOM.
   * @param logger - The logger object.
   */
  constructor({ logger }: { logger: Logger }) {
    this.logger = logger.scope("ShadowDOM");
    this.util = new Util({ logger: this.logger });
    this.createShadowRoot();
  }

  /**
   * Create the shadow root.
   * 
   * This function creates the shadow root and appends the necessary styles and scripts.
   */
  protected createShadowRoot() {
    this.shadowContainer = document.createElement("div");
    this.shadowRoot = this.shadowContainer.attachShadow({ mode: "closed" });
    this.shadowRoot.appendChild(this.util.createElement({ tag: "link", attributes: { rel: "stylesheet", href: "../node_modules/bootstrap/dist/css/bootstrap.min.css" } }));
    this.shadowRoot.appendChild(this.util.createElement({ tag: "link", attributes: { rel: "stylesheet", href: "../node_modules/bootstrap-icons/font/bootstrap-icons.css" } }));
    this.shadowRoot.appendChild(this.util.createElement({ tag: "script", attributes: { src: "../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js" } }));
  }

  /**
   * Get the shadow container.
   * 
   * @returns The shadow container.
   */
  getShadowContainer() {
    return this.shadowContainer;
  }

  /**
   * Get the shadow root.
   * 
   * @returns The shadow root.
   */
  getShadowRoot() {
    return this.shadowRoot;
  }
}

export { ShadowDOM };