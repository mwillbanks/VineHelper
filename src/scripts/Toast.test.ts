import { expect, test, describe, beforeEach, vi } from 'vitest';
import { Logger } from './Logger';
import { Toast } from './Toast';
import { ShadowDOM } from './ShadowDOM';
import { Toast as BSToast } from 'bootstrap';

describe('Toast', () => {
  let toast: Toast;
  let logger: Logger;
  let shadowDOM: ShadowDOM;
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    logger = new Logger();
    shadowDOM = new ShadowDOM({ logger });
    shadowRoot = shadowDOM.getShadowRoot();
    toast = new Toast({ logger, shadowRoot });
  });

  test('show should create and append a toast message to the container', () => {
    const title = 'Test Title';
    const message = 'Test Message';

    toast.show({ title, message });

    const toastContainer = shadowRoot.getElementById('toast-container')!;
    const toastMessage = toastContainer.querySelector('.toast')!;

    expect(toastMessage).not.toBeNull();
    expect(toastMessage.querySelector('.me-auto')!.textContent).toBe(title);
    expect(toastMessage.querySelector('.toast-body')!.textContent).toBe(message);
  });

  test('show should call BSToast.getOrCreateInstance to show the toast', () => {
    const title = 'Test Title';
    const message = 'Test Message';

    const getOrCreateInstanceSpy = vi.spyOn(BSToast, 'getOrCreateInstance');
    toast.show({ title, message });

    expect(getOrCreateInstanceSpy).toHaveBeenCalled();
  });

  test('show should remove the toast message when it is hidden', () => {
    const title = 'Test Title';
    const message = 'Test Message';

    toast.show({ title, message });

    const toastContainer = shadowRoot.getElementById('toast-container')!;
    const toastMessage = toastContainer.querySelector('.toast')!;

    const hiddenEvent = new Event('hidden.bs.toast');
    toastMessage.dispatchEvent(hiddenEvent);

    expect(toastContainer.querySelector('.toast')).toBeNull();
  });
});