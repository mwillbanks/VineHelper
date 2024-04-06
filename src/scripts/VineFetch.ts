import { Logger } from './Logger';
import { Util } from './Util';
import { Vine } from './Vine';

export class VineFetch {
  protected originalFetch: typeof window.fetch;
  protected log: Logger;
  protected util: Util;
  protected vine: Vine;

  protected lastParentRegex: RegExp = /^.+?#(.+?)#.+$/;
  protected lastParentVariant: any = null;
  protected urlStartToMethod: { [key: string]: Function } = {
    'api/voiceOrders': this.responseOrders,
    'api/recommendations': this.responseRecommendations,
  };

  constructor({ logger }: { logger: Logger }) {
    this.log = logger.scope("vineFetch");
    this.util = new Util({ logger: this.log });
    this.vine = new Vine();

    this.log.info("Duck typing fetch");
    this.originalFetch = window.fetch;
    window.fetch = this.fetch.bind(this) as typeof window.fetch; // Update the type of fetch
  }

  async fetch(...args: [RequestInfo, RequestInit]) {
    const log = this.log.scope("fetch");
    log.debug("params", args);

    let response: Response;
    try {
      response = await this.originalFetch(...args);
    } catch (error) {
      log.error("fetch:error", error);
      return error;
    }
    log.debug("response", response);

    const url = args[0] as string;
    for (const [start, method] of Object.entries(this.urlStartToMethod)) {
      if (url.startsWith(start)) {
        response = await method.call(this, args, response);
        break;
      }
    }

    return response;
  }

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
      return;
    }

    if (lastParent) {
      log.debug("has lastParent", lastParent);
      lastParent = lastParent.recommendationId.match(this.lastParentRegex)?.[1];
      log.debug("new lastParent", lastParent);
    }

    let data = {
      status: "success",
      error: null,
      parent_asin: lastParent,
      asin: asin,
    };
    if (responseData.error !== null) {
      data.status = "failed";
      data.error = responseData.error; //CROSS_BORDER_SHIPMENT, SCHEDULED_DELIVERY_REQUIRED, ITEM_NOT_IN_ENROLLMENT
    }

    log.debug("postMessage", data);
    window.postMessage(
      {
        type: "order",
        data,
      },
      "*"
    );

    //Wait 500ms following an order to allow for the order report query to go through before the redirect happens.
    await new Promise((r) => setTimeout(r, 500));
    return response;
  }

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
      return;
    }

    let { result, error } = responseData;
    if (result === null) {
      if (error?.exceptionType) {
        window.postMessage(
          {
            type: "error",
            data: {
              error: error.exceptionType,
            },
          },
          "*"
        );
      }
      return response;
    }

    if (result.variations !== undefined) {
      this.lastParentVariant = result;
    } else if (result.taxValue !== undefined) {
      const isChild = !!lastParent?.variations?.some((v: any) => v.asin == result.asin);
      let data = {
        parent_asin: null,
        asin: result.asin,
        etv: result.taxValue,
      };
      if (isChild) {
        data.parent_asin = lastParent.recommendationId.match(this.lastParentRegex)?.[1];
      } else {
        this.lastParentVariant = null;
      }
      window.postMessage(
        {
          type: "etv",
          data,
        },
        "*"
      );
    }

    let fixed = 0;
    result.variations = result.variations?.map((variation: {
      asin: string;
      dimensions: Record<string, string>;
    }) => {
      if (Object.keys(variation.dimensions || {}).length === 0) {
        variation.dimensions = {
          asin_no: variation.asin,
        };
        fixed++;
        return variation;
      }

      for (const key in variation.dimensions) {
        // The core of the issue is when a special character is at the end of a variation, the jQuery UI which amazon uses will attempt to evaluate it and fail since it attempts to utilize it as part of an html attribute.
        // In order to resolve this, we make the string safe for an html attribute by escaping the special characters.
        if (!variation.dimensions[key].match(/[a-z0-9]$/i)) {
          variation.dimensions[key] = variation.dimensions[key] + ` VH${fixed}`;
          fixed++;
        }

        // Any variation with a : without a space after will crash, ensure : always has a space after.
        const newValue = variation.dimensions[key].replace(/:([^\s])/g, ": $1");
        if (newValue !== variation.dimensions[key]) {
          variation.dimensions[key] = newValue;
          fixed++;
        }
      }
      return variation;
    });

    if (fixed > 0) {
      window.postMessage(
        {
          type: "infiniteWheelFixed",
          text: fixed + " variation(s) fixed.",
        },
        "*"
      );
    }

    return new Response(JSON.stringify(responseData));
  }
}