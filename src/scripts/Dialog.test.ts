import { expect, test, describe, beforeEach, vi } from 'vitest';
import { Dialog, DialogOptions } from './Dialog';
import { Logger } from './Logger';

vi.mock('./Logger');

describe('Dialog', () => {
  let dialog: Dialog;
  let logger: Logger;
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    logger = new Logger();
    logger.scope = vi.fn().mockReturnValue(logger);
    shadowRoot = document.createElement('div').attachShadow({ mode: 'open' });
    dialog = new Dialog({ logger, shadowRoot });
  });

  test('create should return a dialog element with title, content, and buttons', () => {
    const options: DialogOptions = {
      title: 'Test Dialog',
      content: 'This is a test dialog',
      buttons: [
        { text: 'Yes', class: 'btn-primary', callback: () => console.log('Yes clicked') },
        { text: 'No', class: 'btn-danger', callback: () => console.log('No clicked') },
      ],
    };

    const dialogElement = dialog.create(options);

    expect(dialogElement.querySelector('.modal-title')!.textContent).toBe('Test Dialog');
    expect(dialogElement.querySelector('.modal-body')!.textContent).toBe('This is a test dialog');
    expect(dialogElement.querySelectorAll('.btn')).toHaveLength(2);
  });

  test('create should execute the callback function when a button is clicked', async () => {
    const callback = vi.fn();
    const options: DialogOptions = {
      title: 'Test Dialog',
      content: 'This is a test dialog',
      buttons: [{ text: 'OK', class: 'btn-primary', callback }],
    };

    const dialogElement = dialog.create(options);
    document.body.appendChild(dialogElement);

    const button = dialogElement.querySelector('.btn-primary');
    button!.dispatchEvent(new Event('click'));

    expect(callback).toHaveBeenCalled();

    document.body.removeChild(dialogElement);
  });
});