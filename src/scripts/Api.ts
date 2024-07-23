import { Constants } from './Constants';
import { Logger } from './Logger';
import { TypeProduct } from './ListManager';
import { Util } from './Util';

/**
 * Vine Helper Api class
 * 
 * This class is used to interact with the Vine Helper V4 API, it will slowly be replaced
 * by the websocket API in the future.
 */
export class Api {
  protected baseUrl: string = Constants.BASE_URL;
  protected defaultVars: any = {
    api_version: 4,
    country: null,
    uuid: null
  };
  protected log: Logger;
  protected util: Util;

  constructor(options: { baseUrl?: string, country?: string, api_version?: number, uuid?: string, logger: Logger }) {
    this.baseUrl = options.baseUrl || this.baseUrl;
    this.defaultVars.country = options.country || this.defaultVars.country;
    this.defaultVars.api_version = options.api_version || this.defaultVars.api_version;
    this.defaultVars.uuid = options.uuid || this.defaultVars.uuid;
    this.log = options.logger.scope("api");
    this.util = new Util({ logger: this.log });
  }

  /**
   * Get products by ASINs
   */
  async products({asins, appVersion, queue} : {asins: string[], appVersion: string, queue: string}) {
    const log = this.log.scope("products");

    let products: TypeProduct[] = [];
    try {
      // log.debug("params", arguments);
      const response = await fetch(this.baseUrl + '/vinehelper.php?data=' + JSON.stringify({
        ...this.defaultVars,
        action: "getinfo",
        app_version: appVersion,
        arr_asin: asins,
        queue: queue,
      }));
      log.debug("response", response);

      const apiProducts = await response.json();
      products = (apiProducts || []).map((acc: TypeProduct[], product: any) => {
        if (!product.img_url) {
          return acc;
        }
        product.imgUrl = product.img_url;
        delete product.img_url;

        if (!product.title) {
          return acc;
        }
        product.title = this.util.decodeHtmlEntities(product.title);

        if (product.parent_asin) {
          product.parentAsin = product.parent_asin;
          delete product.parent_asin;
        }

        if (typeof product.timestamp === "number") {
          product.timestamp = product.timestamp * 1000;
        } else {
          const [date, time] = product.date.split(" ");
          product.timestamp = new Date(date + "T" + time + "Z").getTime();
          delete product.date;
        }

        if (product.etv) {
          if (product.etv.indexOf("-") > -1) {
            const [etvMin, etvMax] = product.etv.split("-")[1].map((etv: string) => parseFloat(etv.trim()));
            product.etvMin = etvMin;
            product.etvMax = etvMax;
          } else {
            product.etv = parseFloat(product.etv);
            product.etvMin = product.etv;
            product.etvMax = product.etv;
          }
        }
        delete product.etv;

        product.search = product.title.replace(/^([a-zA-Z0-9\s',]{0,40})[\s]+.*$/, "$1");
        acc.push({
          ...product,
        });
        return acc;
      }, [] as TypeProduct[]);
      log.debug("products", products);
    } catch (error) {
      log.error("error", error);
    }

    return products;
  }
}