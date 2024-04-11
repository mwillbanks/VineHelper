import { test, describe, expect, vi, beforeEach } from 'vitest';
import { Modal } from './Modal';
import { Logger } from './Logger';
import { ShadowDOM } from './ShadowDOM';

vi.mock('./Logger');

describe('Modal', () => {
  let modal: Modal;
  let logger: Logger;
  let shadowDOM: ShadowDOM;
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    logger = new Logger();
    logger.scope = vi.fn().mockReturnValue(logger);

    shadowDOM = new ShadowDOM({ logger });
    shadowRoot = shadowDOM.getShadowRoot();
    modal = new Modal({ logger, shadowRoot });
  });

  test('should create a modal element with title, content, and footer', () => {
    const title = 'Modal Title';
    const content = 'Modal Content';
    const footer = 'Modal Footer';

    const element = modal.create({ title, content, footer });

    expect(element).not.toBeNull();
    expect(element.classList.contains('modal')).toBe(true);

    // Assert that the modal element has the correct title
    const modalTitle = element.querySelector('.modal-title');
    expect(modalTitle).toBeDefined();
    expect(modalTitle!.textContent).toBe(title);

    // Assert that the modal element has the correct content
    const modalContent = element.querySelector('.modal-body');
    expect(modalContent).toBeDefined();
    expect(modalContent!.textContent).toBe(content);

    // Assert that the modal element has the correct footer
    const modalFooter = element.querySelector('.modal-footer');
    expect(modalFooter).toBeDefined();
    expect(modalFooter!.textContent).toBe(footer);
  });

  test('should create a modal element without footer', () => {
    const title = 'Modal Title';
    const content = 'Modal Content';

    const element = modal.create({ title, content });

    // Assert that the modal element is created
    expect(element).toBeDefined();

    // Assert that the modal element does not have a footer
    const modalFooter = element.querySelector('.modal-footer');
    expect(modalFooter).toBeNull();
  });
});