import { Modal as BSModal } from 'bootstrap';
import { Logger } from './Logger';
import { Util } from './Util';

/**
 * Modal
 * 
 * Dynamically creates a bootstrap modal inside of a provided shadow root and destroys itself when closed
 * using a static method.
 */
export class Modal {
  protected modals: Map<HTMLElement, BSModal> = new Map();

  protected logger: Logger;
  protected shadowRoot: ShadowRoot;
  protected util: Util;

  /**
   * Creates an instance of Modal.
   * 
   * @param {Object} options - The options for the Modal.
   * @param {Logger} options.logger - The logger instance.
   * @param {ShadowRoot} options.shadowRoot - The shadow root where the modal will be created.
   */
  constructor({ logger, shadowRoot }: { logger: Logger, shadowRoot: ShadowRoot }) {
    this.logger = logger.scope("modal");
    this.shadowRoot = shadowRoot;
    this.util = new Util({ logger });
  }

  /**
   * Creates a new modal.
   * 
   * @param {Object} options - The options for creating the modal.
   * @param {string | HTMLElement} options.title - The title of the modal.
   * @param {string | HTMLElement} options.content - The content of the modal.
   * @param {string | HTMLElement} [options.footer] - The footer of the modal.
   * @param {BSModal.Options} [options.options] - Additional options for the modal.
   * @returns {HTMLElement} The created modal element.
   */
  create({ title, content, footer, options }: { title: string | HTMLElement, content: string | HTMLElement, footer?: string | HTMLElement, options?: BSModal.Options }): HTMLElement {
    const modal = this.util.createElement({
      tag: "div", attributes: { class: "modal fade", tabindex: "-1", role: "dialog" }, children: [
        {
          tag: "div", attributes: { class: "modal-dialog", role: "document" }, children: [
            {
              tag: "div", attributes: { class: "modal-content" }, children: [
                {
                  tag: "div", attributes: { class: "modal-header" }, children: [
                    (title instanceof HTMLElement ? title : { tag: "h5", attributes: { class: "modal-title", textContent: title } })
                  ]
                },
                (content instanceof HTMLElement ? content : { tag: "div", attributes: { class: "modal-body", textContent: content } }),
                ...(footer ? [{
                  tag: "div", attributes: {
                    class: "modal-footer", ...{
                      ...(typeof footer === "string" ? { textContent: footer } : {})
                    }
                  }, children: footer instanceof HTMLElement ? [footer] : []
                }] : []),
              ]
            }
          ]
        }
      ]
    });

    this.shadowRoot.appendChild(modal);

    const bsModal = new BSModal(modal, options);
    modal.addEventListener("hidden.bs.modal", () => {
      this.modals.delete(modal);
      bsModal.dispose();
      modal.remove();
    });
    bsModal.show();
    this.modals.set(modal, bsModal);

    return modal;
  }
}