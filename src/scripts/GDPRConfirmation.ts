import { Logger } from "./Logger";
import { GlobalSettings } from "./Settings";
import { Dialog } from "./Dialog";

/**
 * Represents a GDPR confirmation dialog that asks the user to accept or decline the GDPR terms of use.
 */
export class GDPRConfirmation extends Dialog {
  protected settings: GlobalSettings;
  protected dialogElement?: HTMLElement;

  /**
   * Creates an instance of GDPRConfirmation.
   * @param settings - The global settings object.
   * @param logger - The logger object.
   * @param shadowRoot - The shadow root element.
   */
  constructor({ settings, logger, shadowRoot }: { settings: GlobalSettings, logger: Logger, shadowRoot: ShadowRoot }) {
    super({ logger, shadowRoot });

    this.logger = logger.scope("GDPRConfirmation");
    this.settings = settings;
  }

  /**
   * Creates the GDPRConfirmation dialog asking the user to accept or decline the GDPR terms of use.
   * 
   * @returns {Promise<boolean>} A promise indicating if the user accepted or declined the GDPR.
   */
  public async confirm(): Promise<boolean> {
    this.logger.debug("show");

    const title = "Privacy Notice: Your Data and GDPR Compliance";
    const content = this.util.createElement({
      tag: "div", attributes: { class: "modal-body" }, children: [
        { tag: "h3", attributes: { textContent: "Privacy Notice: Your Data and GDPR Compliance" } },
        { tag: "p", attributes: { textContent: "VineHelper care about your privacy and want you to understand how your personal data is handled when you use the extension. By continuing to use Vine Helper, you consent to the collection and processing of your personal data as described in this Privacy Notice and" } },
        { tag: "a", attributes: { href: "https://vinehelper.ovh/privacy.html", textContent: "privacy policy" } },
        { tag: "h3", attributes: { textContent: "What data do we collect?" } },
        { tag: "p", attributes: { textContent: "VineHelper do NOT collect personal data such as your name, email address, contact information, account information or cookies." } },
        { tag: "p", attributes: { textContent: "VineHelper do collect browsing activity on Amazon Vine (not Amazon as a whole) when you interact with our application." } },
        { tag: "h3", attributes: { textContent: "How do we use your data?" } },
        { tag: "p", attributes: { textContent: "We assign your installation of VineHelper a UUID, a unique code, which allow to distinguish you as an individual user, while protecting your identify and privacy. We use this UUID to make some features of the extension work. For example: being able to share hidden products between devices, avoiding duplicate votes, etc." } },
        { tag: "p", attributes: { textContent: "While your UUID does not expire, data such as votes, order attempts, and product info you may submit to our server are automatically purged after 90 days." } },
        { tag: "h3", attributes: { textContent: "Your rights" } },
        { tag: "p", attributes: { textContent: "You have the right to delete your personal data. Please contact us if you wish to exercise any of these rights." } },
        { tag: "h3", attributes: { textContent: "Data security" } },
        { tag: "p", attributes: { textContent: "We take the security of your data seriously. But keep in mind this is an amateur project with limited resources." } },
        { tag: "h3", attributes: { textContent: "Third-party disclosure" } },
        { tag: "p", attributes: { textContent: "We will not share your UUID with anyone, unless legally mandated to do so by law." } },
        { tag: "p", attributes: { textContent: "We may share collected data (excluding UUID) to other projects." } },
        { tag: "h3", attributes: { textContent: "Cookies and tracking" } },
        { tag: "p", attributes: { textContent: "VineHelper does not use, or access, cookies. VineHelper does keep track of your purchases for the purpose of making the order system count works." } },
        { tag: "h3", attributes: { textContent: "Updates to this Privacy Notice" } },
        { tag: "p", attributes: { textContent: "We may update this Privacy Notice to reflect changes in our data processing practices. We encourage you to review this Notice periodically for any updates." } },
        { tag: "p", attributes: { textContent: "By using VineHelper, you agree to the terms of this Privacy Notice and privacy policy and consent to the processing of your personal data as described." } },
        { tag: "p", attributes: { textContent: "If you have any questions or concerns about our data processing practices, please contact me at [fmaz008@gmail.com]. - Francois :)" } },
      ]
    });

    return new Promise(resolve => {
      this.create({
        title, content, buttons: [
          {
            text: "Accept", class: "btn-primary", callback: () => this.accept(resolve)
          },
          {
            text: "Decline", class: "btn-danger", callback: () => this.decline(resolve)
          },
        ]
      })
    });
  }

  /**
   * Accepts the GDPR terms of use.
   * 
   * @param resolve - The resolve function of the promise.
   */
  protected async accept(resolve: (value: boolean) => void) {
    this.logger.debug("accept");

    await this.settings.setProperty("general.GDPRPopup", false);
    resolve(true);
  }

  /**
   * Declines the GDPR terms of use.
   * 
   * @param resolve - The resolve function of the promise.
   */
  protected async decline(resolve: (value: boolean) => void) {
    this.logger.debug("decline");

    await this.settings.setProperty("general.GDPRPopup", true);
    resolve(false);
  }
}
