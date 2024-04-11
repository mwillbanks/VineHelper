import { Logger } from "./Logger";
import { Util } from "./Util";

class ShadowDOMProxy {
  private originalElement: HTMLElement;
  private clonedElement: HTMLElement;

  constructor(element: HTMLElement) {
    this.originalElement = element;
    this.clonedElement = this.cloneElement(element);
    this.proxyEvents();
  }

  private cloneElement(element: HTMLElement): HTMLElement {
    const clone = element.cloneNode(true) as HTMLElement;
    return clone;
  }

  private proxyEvents() {
    const originalElement = this.originalElement;
    const clonedElement = this.clonedElement;

    // All event types which bubble
    const bubbleEventTypes = ['click', 'input', 'change', 'keydown', 'keyup', 'focus', 'blur', 'submit'];
    // All non-bubbling event types
    const nonBubblingEventTypes = ['focusin', 'focusout', 'mouseenter', 'mouseleave'];

    [...bubbleEventTypes, ...nonBubblingEventTypes].forEach(eventType => {
      clonedElement.addEventListener(eventType, (event: Event) => {
        originalElement.dispatchEvent({
          ...event,
          bubbles: bubbleEventTypes.includes(eventType),
          cancelable: true,
          composed: true,
          target: originalElement,
          currentTarget: originalElement,
          srcElement: originalElement,
        });
      }, false);
    });

    this.proxyChildEvents(originalElement, clonedElement);
  }

  private proxyChildEvents(originalElement: HTMLElement, clonedElement: HTMLElement) {
    const originalChildNodes = originalElement.childNodes;
    const clonedChildNodes = clonedElement.childNodes;

    for (let i = 0; i < originalChildNodes.length; i++) {
      const originalChild = originalChildNodes[i] as HTMLElement;
      const clonedChild = clonedChildNodes[i] as HTMLElement;

      if (originalChild instanceof HTMLElement && clonedChild instanceof HTMLElement) {
        this.proxyEvents(originalChild, clonedChild);
      }
    }
  }
}

// Usage example:
const element = document.getElementById('myElement');
const proxy = new ShadowDOMProxy(element);

// Add your code here to interact with the proxy and original elements
// For example, you can add event listeners to the proxy element
proxy.addEventListener('click', (event: Event) => {
  // Handle the click event on the proxy element
});

// You can also access the original element through the proxy
const originalElement = proxy.getOriginalElement();
originalElement.addEventListener('keydown', (event: Event) => {
  // Handle the keydown event on the original element
});