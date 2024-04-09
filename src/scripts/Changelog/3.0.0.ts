import { ChangelogVersion } from '../Changelog';

export default {
  // For the changelog, we want to not only display information to the user about
  // the changes since they last upgraded, but we also may need to apply various
  // migrations to our stored data as well. This allows for those transformations
  // to happen in a controlled manner and in a way that is easy to manage.
  version: "3.0.0",
  content: () => {
    const content = document.createElement("div");
    content.innerHTML = `
      <h4>Version 3.0.0</h4>
      <p>
        This version of Vine Helper is a complete rewrite of the extension. It's
        been updated to use the latest technologies and best practices for building
        browser extensions. This version is a major update and includes many new
        features and improvements. Please see the list below for more information.
      </p>
      <h5>Features</h5>
      <ul>
        <li><strong>NEW</strong> Side Panel (check the reading list panel dropdown in chrome).</li>
        <li><strong>NEW</strong> Native Browser Notifications.</li>
        <li><strong>NEW</strong> Theming Capabilities.</li>
      </ul>
    `;
    return content;
  },
  migration: async ({ logger }) => {
    // We need to migrate various existing settings and data to the new format.
    // @NOTE there is not a new format but this is to provide an example of the
    // changelog functionality.
    logger.info("Migrating data to version 3.0.0");
  }
} as ChangelogVersion;;