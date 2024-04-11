import { expect, test, describe, beforeEach, vi } from 'vitest';
import { GDPRConfirmation } from './GDPRConfirmation';
import { Logger } from './Logger';
import { GlobalSettings } from './Settings';
import { ShadowDOM } from './ShadowDOM';

vi.mock('./Logger');

describe('GDPRConfirmation', () => {
  let gdprConfirmation: GDPRConfirmation;
  let settings: GlobalSettings;
  let logger: Logger;
  let shadowDOM: ShadowDOM;
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    logger = new Logger();
    logger.scope = vi.fn().mockReturnValue(logger);
    settings = new GlobalSettings({ logger });
    shadowDOM = new ShadowDOM({ logger });
    shadowRoot = shadowDOM.getShadowRoot();
    gdprConfirmation = new GDPRConfirmation({ settings, logger, shadowRoot });
  });

  test('confirm should create the GDPRConfirmation', () => {
    gdprConfirmation.confirm();
    expect(shadowRoot.querySelector('.modal-title')!.textContent).toBe('Privacy Notice: Your Data and GDPR Compliance');
  });

  test('accept should set the GDPRPopup property to false', async () => {
    const accept = gdprConfirmation.confirm();

    const btn = shadowRoot.querySelector('.btn-primary');
    btn!.dispatchEvent(new Event('click'));

    await accept;
    const gdprPopup = await settings.getProperty('general.GDPRPopup');
    expect(gdprPopup).toBe(false);
  });

  test('decline should set the GDPRPopup property to true', async () => {
    const decline = gdprConfirmation.confirm();

    const btn = shadowRoot.querySelector('.btn-danger');
    btn!.dispatchEvent(new Event('click'));

    await decline;
    const gdprPopup = await settings.getProperty('general.GDPRPopup');
    expect(gdprPopup).toBe(true);
  });
});