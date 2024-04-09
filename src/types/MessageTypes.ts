/**
 * This file contains message types for communication between the content script and the background script.
 * 
 * The message types are used to communicate between the content script and the background script. The content
 * script sends messages to the background script to request data or perform actions. The background script
 * sends messages to the content script to provide data or notify about events.
 */

/**
 * Generic message type
 * 
 * This type is used for messages mainly when testing and debugging as it can contain any data. Once
 * the message type is known, it is recommended to use or create a more specific type.
 */
export interface TypeMessageGeneric {
  type: string;
  data: {
    [key: string]: any;
  };
};

/**
 * Product message type
 * 
 * This type is used for messages that contain product data but is generally not used directly. Instead,
 * it is recommended to use or create a more specific type.
 */
export interface TypeMessageProduct extends TypeMessageGeneric {
  type: string;
  data: {
    asin: string;
    parent_asin: string | null;
  };
};

/**
 * Order message type
 * 
 * This type is used for messages containing an order attempt on a specific product.
 */
export interface TypeMessageOrder extends TypeMessageProduct {
  type: "order";
  data: {
    status: string;
    error: null | string; // CROSS_BORDER_SHIPMENT, SCHEDULED_DELIVERY_REQUIRED, ITEM_NOT_IN_ENROLLMENT
  } & TypeMessageProduct["data"];
};

/**
 * ETV message type
 * 
 * This type is used for messages when the ETV is discovered for a product that was previously not known.
 */
export interface TypeMessageETV extends TypeMessageProduct {
  type: "etv";
  data: {
    etv: number;
  } & TypeMessageProduct["data"];
};

/**
 * Infinite wheel fixed message type
 * 
 * This type is used for messages when the infinite wheel has fixed a variation.
 */
export type TypeMessageVariationFixed = {
  type: "infiniteWheelFixed";
  text: string;
};