import { Dialog } from './Dialog';
import { GlobalSettings } from './Settings';
import { Logger } from './Logger';

/**
 * Represents a version of the changelog.
 * 
 * The version object should contain a version number and a content function that returns an HTMLElement.
 * Optionally, a migration function can be provided which is migrated when the changelog is displayed.
 */
export interface ChangelogVersion {
  version: string;
  content: () => HTMLElement;
  migration?: ({ logger } : { logger: Logger }) => Promise<void>;
}

/**
 * Represents a Changelog dialog that displays the changes between versions.
 */
export class Changelog extends Dialog {
  protected settings: GlobalSettings;

  /**
   * Creates an instance of Changelog.
   * @param settings - The global settings object.
   * @param logger - The logger object.
   * @param shadowRoot - The shadow root element.
   */
  constructor({ settings, logger, shadowRoot }: { settings: GlobalSettings, logger: Logger, shadowRoot: ShadowRoot }) {
    super({ logger, shadowRoot });

    this.settings = settings;

    const [versionInfoPopup, versionCurrent, versionPrevious] = this.settings.getProperties([
      'general.versionInfoPopup',
      'general.versionCurrent',
      'general.versionPrevious',
    ]) as [boolean, string, string | undefined];

    if (versionInfoPopup && versionPrevious && this.util.versionCompare(versionCurrent, versionPrevious) > 0) {
      this.showDialog(versionPrevious, versionCurrent);
    }
  }

  /**
   * Registers a version with the changelog.
   * 
   * Locate all versions that are greater than the previous version by trying to dynamically import their changelogs,
   * if a bug fix version is not found, go to the next minor version, and so on.
   * 
   * @param versionPrevious - The previous version number.
   * @param versionCurrent - The current version number.
   * @returns The changelog content.
   */
  protected async findVersions(versionPrevious: string, versionCurrent: string): Promise<ChangelogVersion[]> {
    const versions: ChangelogVersion[] = [];
    let versionParts = versionPrevious.split(".").map(Number);
    let versionString;
    let incrementPart = versionParts.length - 1;
    do {
      // set parts extending past the incrementPart to the end to 0, and increment incrementPart
      versionParts = versionParts.map((v, i) => i > incrementPart ? 0 : i === incrementPart ? v + 1 : v);
      versionString = versionParts.join(".");
      try {
        const version = await import(`./Changelog/${versionString}`);
        versions.push(version);
        incrementPart = versionParts.length - 1; // Since the version exists, reset the increment part to the last part
      } catch (error) {
        incrementPart--; // If the version does not exist, try the next part
      }
    } while (versionString !== versionCurrent);

    return versions;
  };

  /**
   * Shows the changelog.
   * 
   * @param versionPrevious - The previous version number.
   * @param versionCurrent - The current version number.
   */
  protected async showDialog(versionPrevious: string, versionCurrent: string): Promise<void> {
    const versions = await this.findVersions(versionPrevious, versionCurrent);

    const changeLogParts : HTMLElement[] = [];
    for (const version of versions) {
      changeLogParts.push(version.content());
      if (version.migration) {
        await version.migration({ logger: this.logger });
      }
    }

    const changeLog = this.util.createElement({
      tag: "div",
      attributes: { class: "modal-content" },
      children: changeLogParts.reverse() // Reverse the order so the latest version is at the top
    });

    this.create({
      title: "Changelog",
      content: changeLog,
      buttons: [{
        text: "Close",
        class: "btn-primary",
        callback: async () => {
          await this.settings.setProperties({ "general.versionInfoPopup": false });
        }
      }]
    });
  }
}