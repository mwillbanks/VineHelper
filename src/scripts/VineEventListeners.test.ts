import { expect, test, describe, beforeEach, afterEach, vi } from 'vitest'
import { VineEventListeners } from './VineEventListeners';

describe('VineEventListeners', () => {
  let vineEventListeners: VineEventListeners;
  let element: Element;

  beforeEach(() => {
    vineEventListeners = new VineEventListeners();
    element = document.createElement('div');
  });

  afterEach(() => {
    // Clean up event listeners after each test
    element.innerHTML = '';
  });

  test('addEventListener should add event listener to the event map', () => {
    const listener = vi.fn();
    const eventType = 'click';

    element.addEventListener(eventType, listener);

    const eventListeners = vineEventListeners.getEventsForElement(element);
    expect(eventListeners.get(eventType)).toContain(listener);
  });

  test('removeEventListener should remove event listener from the event map', () => {
    const listener = vi.fn();
    const eventType = 'click';

    element.addEventListener(eventType, listener);
    element.removeEventListener(eventType, listener);

    const eventListeners = vineEventListeners.getEventsForElement(element);
    expect(eventListeners.get(eventType)).not.toContain(listener);
  });

  test('getEventsForElement should return event listeners for a specific element', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const eventType1 = 'click';
    const eventType2 = 'keydown';

    element.addEventListener(eventType1, listener1);
    element.addEventListener(eventType2, listener2);

    const eventListeners = vineEventListeners.getEventsForElement(element);
    expect(eventListeners.get(eventType1)).toContain(listener1);
    expect(eventListeners.get(eventType2)).toContain(listener2);
  });

  test('getParentEventsForElement should return event listeners for the ancestors of a specific element', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const eventType1 = 'click';
    const eventType2 = 'keydown';

    const parentElement = document.createElement('div');
    const grandparentElement = document.createElement('div');

    parentElement.addEventListener(eventType1, listener1);
    grandparentElement.addEventListener(eventType2, listener2);

    grandparentElement.appendChild(parentElement);
    parentElement.appendChild(element);

    const eventListeners = vineEventListeners.getParentEventsForElement(element);
    expect(eventListeners.get(eventType1)).toContain(listener1);
    expect(eventListeners.get(eventType2)).toContain(listener2);
  });

  test('retargetEventsOnShadowNode should retarget events from the shadow node to the original node', () => {
    const originalNode = document.createElement('div');
    const shadowNode = document.createElement('div');

    const eventType = 'click';
    const event = new Event(eventType);

    const originalListener = vi.fn();

    originalNode.addEventListener(eventType, originalListener);
    vineEventListeners.retargetEventsOnShadowNode(shadowNode, originalNode);
    shadowNode.dispatchEvent(event);

    expect(originalListener).toHaveBeenCalledTimes(1);
  });
});