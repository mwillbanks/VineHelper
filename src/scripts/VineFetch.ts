import browser from "webextension-polyfill"; // Cross-Browser Compatibility
import { TypeMessageETV, TypeMessageGeneric, TypeMessageOrder, TypeMessageVariationFixed } from '../types/MessageTypes'; // Type Definitions
import { Logger } from './Logger'; // Logging
import { Util } from './Util'; // Utility Methods
import { Vine } from './Vine'; // Vine API & Attributes

/**
 * VineFetch Class
 * 
 * This class is responsible for intercepting fetch requests and modifying the response before it is returned.
 */
export class VineFetch {
  protected log: Logger;
  protected util: Util;
  protected vine: Vine;

  /**
   * The original fetch function from the window object.
   */
  protected originalFetch: typeof window.fetch;
  /**
   * The last parent asin regex.
   */
  protected lastParentRegex: RegExp = /^.+?#(.+?)#.+$/;
  /**
   * The last parent asin variant.
   */
  protected lastParentVariant: any = null;
  /**
   * Url patterns to methods.
   * 
   * This object is used to match the path portion of the url to a interceptor method.
   */
  protected urlStartToMethod: { [key: string]: Function } = {
    'api/voiceOrders': this.responseOrders,
    'api/recommendations': this.responseRecommendations,
  };

  /**
   * Constructor
   * 
   * This method initializes the class and sets the logger, util, and vine attributes and updates the fetch method.
   */
  constructor({ logger }: { logger: Logger }) {
    this.log = logger.scope("vineFetch");
    this.util = new Util({ logger: this.log });
    this.vine = new Vine();

    this.log.debug("Duck typing fetch");
    this.originalFetch = window.fetch;
    window.fetch = this.fetch.bind(this) as typeof window.fetch; // Update the type of fetch
  }

  /**
   * Fetch
   * 
   * This method is responsible for intercepting fetch requests and matching them to the appropriate method.
   */
  async fetch(...args: [RequestInfo, RequestInit]) {
    const log = this.log.scope("fetch");
    log.debug("params", args);

    let response: Response;
    try {
      response = await this.originalFetch(...args);
    } catch (error) {
      log.error("error", error);
      return error;
    }
    log.debug("original response", response);

    // Match the url to the appropriate method and call it fetching the response.
    const url = args[0] as string;
    for (const [start, method] of Object.entries(this.urlStartToMethod)) {
      if (url.startsWith(start)) {
        response = await method.call(this, args, response);
        break;
      }
    }

    log.debug("response", response);
    return response;
  }

  /**
   * Response Orders
   * 
   * This method is responsible for sending the order status to the service worker.
   */
  async responseOrders(request: [RequestInfo, RequestInit], response: Response) {
    const log = this.log.scope("responseOrders");
    log.debug("params", arguments);
    let lastParent = this.lastParentVariant;

    const postData = JSON.parse(request[1].body as string);
    const asin = postData.itemAsin;

    let responseData: any = null;
    try {
      responseData = await response.clone().json();
    } catch (error) {
      log.error(error);
      return;
    }
    if (!responseData) {
      log.debug("no response data");
      return;
    }
    log.debug("response data", responseData);

    if (lastParent) {
      log.debug("has lastParent", lastParent);
      lastParent = lastParent.recommendationId.match(this.lastParentRegex)?.[1];
      log.debug("new lastParent", lastParent);
    }

    const message: TypeMessageOrder = {
      type: "order",
      data: {
        status: responseData.error !== null ? "success" : "failed",
        error: responseData.error,
        parent_asin: lastParent,
        asin: asin,
      }
    };

    log.debug("sendMessage(order)", message);
    browser.runtime.sendMessage(message);

    // Wait 500ms following an order to allow for the order report query to go through before the redirect happens.
    await new Promise((r) => setTimeout(r, 500));
    return response;
  }

  /**
   * Response Recommendations
   * 
   * This method is responsible for sending the ETV to the service worker and fixing variations.
   */
  async responseRecommendations(_request: [RequestInfo, RequestInit], response: Response) {
    const log = this.log.scope("responseRecommendations");
    log.debug("params", arguments);
    let lastParent = this.lastParentVariant;

    let responseData: any = null;
    try {
      responseData = await response.clone().json();
    } catch (error) {
      log.error(error);
      return;
    }
    if (!responseData) {
      log.debug("no response data");
      return;
    }
    log.debug("response data", responseData);

    let { result, error } = responseData;
    if (result === null) {
      if (error?.exceptionType) {
        log.error("error", error);
        const message: TypeMessageGeneric = {
          type: "error",
          data: {
            error: error.exceptionType,
          }
        };
        browser.runtime.sendMessage(message);
      }
      return response;
    }

    if (result.variations !== undefined) {
      log.debug("has variations", result.variations);
      this.lastParentVariant = result;
    } else if (result.taxValue !== undefined) {
      log.debug("has taxValue", result.taxValue);
      const isChild = !!lastParent?.variations?.some((v: any) => v.asin == result.asin);
      const message: TypeMessageETV = {
        type: "etv",
        data: {
          parent_asin: null,
          asin: result.asin,
          etv: result.taxValue,
        }
      };
      if (isChild) {
        log.debug("is child", lastParent);
        message.data.parent_asin = lastParent.recommendationId.match(this.lastParentRegex)?.[1];
      } else {
        log.debug("is parent", lastParent);
        this.lastParentVariant = null;
      }

      log.debug("sendMessage(etv)", message);
      browser.runtime.sendMessage(message);
    }

    let fixed = 0;
    result.variations = result.variations?.map((variation: {
      asin: string;
      dimensions: Record<string, string>;
    }) => {
      log.debug("fixing variation", variation);
      if (Object.keys(variation.dimensions || {}).length === 0) {
        log.debug("fixed dimension");
        variation.dimensions = {
          asin_no: variation.asin,
        };
        fixed++;
        return variation;
      }

      for (const key in variation.dimensions) {
        // The core of the issue is when a special character is at the end of a variation, the jQuery UI which
        // amazon uses will attempt to evaluate it and fail since it attempts to utilize it as part of an html
        // attribute. In order to resolve this, we make the string safe for an html attribute by escaping the
        // special characters.
        if (!variation.dimensions[key].match(/[a-z0-9]$/i)) {
          log.debug("fixed special character", variation.dimensions[key]);
          variation.dimensions[key] = variation.dimensions[key] + ` VH${fixed}`;
          fixed++;
        }

        // Any variation with a : without a space after will crash, ensure : always has a space after.
        const newValue = variation.dimensions[key].replace(/:([^\s])/g, ": $1");
        if (newValue !== variation.dimensions[key]) {
          log.debug("fixed colon", variation.dimensions[key]);
          variation.dimensions[key] = newValue;
          fixed++;
        }
      }
      return variation;
    });

    if (fixed > 0) {
      const message: TypeMessageVariationFixed = {
        type: "infiniteWheelFixed",
        text: `${fixed} variation(s) fixed.`,
      };
      log.debug("sendMessage(infiniteWheelFixed)", message);
      browser.runtime.sendMessage(message);
    }

    return new Response(JSON.stringify(responseData));
  }
}