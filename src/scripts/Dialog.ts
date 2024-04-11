import { Modal as BSModal } from 'bootstrap';
import { Modal } from './Modal';
import { Logger } from './Logger';

/**
 * Represents the options for creating a dialog.
 */
export type DialogOptions = {
  title: string | HTMLElement; // The title of the dialog.
  content: string | HTMLElement; // The content of the dialog.
  buttons?: {
    text: string; // The text of the button.
    class: string; // The CSS class of the button.
    callback: () => void; // The callback function to be executed when the button is clicked.
  }[];
  modalOptions?: BSModal.Options; // The options for configuring the underlying Bootstrap modal.
};

/**
 * Dialog
 * 
 * Dynamically creates a Modal in the form of a Dialog for either forcing a Yes/No response or for displaying information.
 */
export class Dialog extends Modal {

  /**
   * Creates a new instance of the Dialog class.
   * 
   * @param logger - The logger instance.
   * @param shadowRoot - The shadow root of the component.
   * @param isConfirm - Optional. Specifies whether the dialog is for confirming an action. Default is false.
   */
  constructor({ logger, shadowRoot }: { logger: Logger, shadowRoot: ShadowRoot, isConfirm?: boolean }) {
    super({ logger, shadowRoot });

    this.logger = logger.scope("dialog");
  }

  /**
   * Creates a dialog with the specified options.
   * 
   * @param options - The options for creating the dialog.
   * @returns {HTMLElement} The created dialog element.
   */
  create(options: DialogOptions): HTMLElement {
    const { title, content, buttons, modalOptions } = options;
    let footer: HTMLElement | undefined;

    if (buttons?.length) {
      footer = this.util.createElement({
        tag: "div", attributes: { class: "btn-group" }, children: buttons.map(({ text, class: btnClass, callback }) => {
          const button = this.util.createElement({
            tag: "button", attributes: { class: `btn ${btnClass}`, textContent: text, onclick: async (event) => {
                if (typeof callback === "function") {
                  await callback();
                }
                event?.target?.dispatchEvent(new Event("hide.bs.modal", { bubbles: true }));
              }
            }
          });
          return button;
        })
      });
    }

    return super.create({ title, content, footer, options: modalOptions });
  }
}