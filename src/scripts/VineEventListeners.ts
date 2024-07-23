if (typeof window === "undefined") {
  globalThis.window = globalThis as Window & typeof globalThis;
}

/**
 * Represents a class that manages event listeners for DOM elements.
 */
export class VineEventListeners {
  /**
   * The map of event listeners for each DOM element.
   * 
   * We use a WeakMap to store the event listeners for each DOM element because it allows us to store
   * the event listeners without preventing the elements from being garbage collected when they are no longer needed.
   */
  private eventMap: WeakMap<EventTarget, Map<string, EventListener[]>>;

  /**
   * Constructs a new instance of the VineEventListeners class.
   */
  constructor() {
    this.eventMap = new WeakMap();
    this.patchEventListeners();
  }

  /**
   * Patches the addEventListener and removeEventListener methods of the EventTarget prototype.
   * This allows tracking of event listeners for each DOM element.
   */
  private patchEventListeners() {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

    // Store a reference to the instance, so we can access it inside the patched methods
    const instance = this;

    /**
     * Patches the addEventListener method of the EventTarget prototype.
     * 
     * This function adds the event listener to the event map before calling the original addEventListener method.
     * 
     * @param type - The event type.
     * @param listener - The event listener.
     * @param options - The event options.
     */
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      let listeners = instance.eventMap.get(this);
      if (!listeners) {
        listeners = new Map<string, EventListener[]>();
        instance.eventMap.set(this, listeners);
      }
      let eventListeners = listeners.get(type);
      if (!eventListeners) {
        eventListeners = [];
        listeners.set(type, eventListeners);
      }
      if (listener) {
        eventListeners.push(listener as EventListener);
      }

      originalAddEventListener.call(this, type, listener, options);
    };

    /**
     * Patches the removeEventListener method of the EventTarget prototype.
     * 
     * This function removes the event listener from the event map before calling the original removeEventListener method.
     * 
     * @param type - The event type.
     * @param listener - The event listener.
     * @param options - The event options.
     */
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const listeners = instance.eventMap.get(this);
      if (listeners) {
        const eventListeners = listeners.get(type);
        if (eventListeners && listener) {
          const index = eventListeners.indexOf(listener as EventListener);
          if (index !== -1) {
            eventListeners.splice(index, 1);
          }
        }
      }

      originalRemoveEventListener.call(this, type, listener, options);
    };
  }

  /**
   * Retrieves the event listeners for a specific DOM element.
   * 
   * This function returns a map of event types to event listeners for the given element.
   * 
   * @param element - The DOM element.
   * @returns A map of event types to event listeners.
   */
  public getEventsForElement(element: Element): Map<string, EventListener[]> {
    return this.eventMap.get(element) || new Map<string, EventListener[]>();
  }

  /**
   * Retrieves the event listeners for the ancestors of a specific DOM element.
   * 
   * This function traverses up the DOM tree to find event listeners on the ancestors of the given element.
   * It stops when it reaches the top of the tree. The result is a map of event types to event listeners.
   * 
   * @param element - The DOM element.
   * @returns A map of event types to event listeners.
   */
  public getParentEventsForElement(element: Element): Map<string, EventListener[]> {
    const result = new Map<string, EventListener[]>();
    
    /**
     * Traverses up the DOM tree to find event listeners on the ancestors of the given element.
     * 
     * This function is called recursively to traverse up the DOM tree and collect event listeners
     * from the ancestors of the given element. It stops when it reaches the top of the tree.
     * 
     * @param node - The current node in the traversal.
     */
    const traverseUp = (node: Node) : void => {
      // Get the event listeners for the current node and add them to the result, me may encounter
      // multiple listeners for the same event type so we need to combine them since we're pushing
      // them all into the same result map.
      const listeners = this.eventMap.get(node);
      if (listeners) {
        /**
         * Iterate over the event listeners for each event type and add them to the result.
         * 
         * @param eventListeners - The event listeners for a specific event type.
         * @param type - The event type.
         * @returns void
         */
        listeners.forEach((eventListeners, type) : void => {
          if (!result.has(type)) {
            result.set(type, [...eventListeners]);
          } else {
            const existingListeners = result.get(type)!;
            result.set(type, existingListeners.concat(eventListeners));
          }
        });
      }

      // If the node has a parent, continue traversing up the tree
      if (node.parentNode) {
        return traverseUp(node.parentNode);
      }
      
      // If the node has a defaultView, check for window listeners so we can include them in the result
      // This is necessary for events like 'resize' and 'scroll' which are attached to the window
      if (node instanceof Element && node.ownerDocument?.defaultView) {
        const windowListeners = this.eventMap.get(node.ownerDocument.defaultView);
        if (windowListeners) {
          /**
           * Iterate over the event listeners for each event type and add them to the result.
           * 
           * @param eventListeners - The event listeners for a specific event type.
           * @param type - The event type.
           * @returns void
           */
          windowListeners.forEach((eventListeners, type) : void => {
            eventListeners = eventListeners || [];
            if (!result.has(type)) {
              result.set(type, [...eventListeners]);
            } else {
              const existingListeners = result.get(type) || [];
              result.set(type, existingListeners.concat(eventListeners));
            }
          });
        }
      }
    };
    traverseUp(element);

    return result;
  }

  /**
   * Retargets events from the originalNode and its children to the shadowNode and its children.
   * 
   * This function handles retargeting events we receive from the shadowNode and then applies them to the
   * originalNode. It also retargets events from the originalNode's children to the shadowNode's children
   * and from the originalNode's ancestors to the shadowNode's parent.
   * 
   * @param shadowNode - The shadow node to which the events will be retargeted.
   * @param originalNode - The original node from which the events will be retargeted.
   */
  public retargetEventsOnShadowNode(shadowNode: Node, originalNode: Node) {
    /**
     * Assigns event listeners to the shadow node.
     * 
     * @param shadowTarget - The shadow node to which the event listeners will be assigned.
     * @param eventListeners - The map of event listeners for each event type.
     * @returns void
     */
    const assignListenersToShadow = (shadowTarget: Node, eventListeners: Map<string, EventListener[]>) : void => {
      /**
       * Iterate over the event listeners for each event type and assign a proxy listener to the shadow node.
       * 
       * @param listeners - The event listeners for a specific event type.
       * @param type - The event type.
       * @returns void
       */
      eventListeners.forEach((listeners, type) : void => {
        /**
         * Iterate over the event listeners for a specific event type and assign a proxy listener to the shadow node.
         * 
         * @returns void
         */
        listeners.forEach(() : void => {
          /**
           * The proxy listener function that will be called when the event is triggered on the shadow node.
           * 
           * This function clones the event and dispatches it on the original node.
           * 
           * @param event - The event that was triggered on the shadow node.
           */
          const proxyListener = (event: Event) => {
            // Clone the event and dispatch it on the original node
            const { type: eventType, ...eventDefaults } = event;

            // We don't want to provide the shadow node as the target, currentTarget, or srcElement
            // because the original node should be the target of the event.
            if (eventDefaults.target === shadowTarget) {
              eventDefaults.target = originalNode;
            }
            if (eventDefaults.currentTarget === shadowTarget) {
              eventDefaults.currentTarget = originalNode;
            }
            if (eventDefaults.srcElement === shadowTarget) {
              eventDefaults.srcElement = originalNode;
            }

            const clonedEvent = new (event.constructor as typeof Event)(eventType, {
              ...eventDefaults,
              bubbles: true,
              cancelable: true,
            });
            originalNode.dispatchEvent(clonedEvent);
          };
          shadowTarget.addEventListener(type, proxyListener);
        });
      });
    };

    // Check to see if the originalNode has any events, and if so, assign them to the shadowNode
    const events = this.getEventsForElement(originalNode as Element);
    if (events.size > 0) {
      assignListenersToShadow(shadowNode, events);
    }

    /**
     * Recursively apply events to the shadowNode's children.
     * 
     * This function applies events to the shadowNode's children by iterating over the originalNode's children
     * and assigning the appropriate event listeners to the shadowNode's children.
     * 
     * @param originalParent - The original parent node.
     * @param shadowParent - The shadow parent node.
     */
    const applyChildEvents = (originalParent: Node, shadowParent: Node) => {
      const originalChildren = originalParent.childNodes;
      const shadowChildren = shadowParent.childNodes;

      for (let i = 0; i < originalChildren.length; i++) {
        const originalChild = originalChildren[i];
        const shadowChild = shadowChildren[i];

        // Apply events to the shadow child
        const childEvents = this.getEventsForElement(originalChild as Element);
        if (childEvents.size > 0) {
          assignListenersToShadow(shadowChild, childEvents);
        }

        // Recurse if the child has children
        if (originalChild.hasChildNodes()) {
          applyChildEvents(originalChild, shadowChild);
        }
      }
    };
    applyChildEvents(originalNode, shadowNode);

    // Apply events to the shadowNode's parent from all of the originalNode's ancestors
    if (originalNode.parentNode) {
      const parentEvents = this.getParentEventsForElement(originalNode.parentNode as Element);
      if (parentEvents.size > 0) {
        assignListenersToShadow((shadowNode.parentNode || shadowNode) as Node, parentEvents);
      }
    }
  }
}
