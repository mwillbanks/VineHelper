import browser from "webextension-polyfill";
import { expect, test, describe, beforeEach, afterEach, vi } from 'vitest'
import { VineFetch } from './VineFetch';
import { Logger } from './Logger';

describe('VineFetch', () => {
  let vineFetch: VineFetch;
  let logger: Logger;
  let resetFetch = globalThis.fetch;

  beforeEach(() => {
    logger = new Logger();
    logger.log = vi.fn();
    vineFetch = new VineFetch({ logger });
  });

  afterEach(() => {
    // Restore the original fetch method after each test
    window.fetch = resetFetch;
  });

  test('responseOrders should send the order status to the service worker', async () => {
    const request: [RequestInfo, RequestInit] = ['https://www.amazon.com/api/voiceOrders', { method: 'POST', body: JSON.stringify({ itemAsin: '12345' }) }];
    const response = new Response(JSON.stringify({ asin: '12345', error: null }), { status: 200 });
    window.fetch = vi.fn().mockResolvedValue(response);
    browser.runtime.sendMessage = vi.fn();
    const sendMessageSpy = vi.spyOn(browser.runtime, 'sendMessage');

    await vineFetch.responseOrders(request, response);

    expect(sendMessageSpy).toHaveBeenCalledWith({
      type: 'order',
      data: {
        status: 'success',
        error: null,
        parent_asin: null,
        asin: '12345',
      },
    });
  });

  test('responseRecommendations should fix variations', async () => {
    const request: [RequestInfo, RequestInit] = ['api/recommendations', { method: 'GET' }];
    const response = new Response(JSON.stringify({ result: { variations: [{ asin: '12345', dimensions: {} }] } }));

    const sendMessageSpy = vi.spyOn(browser.runtime, 'sendMessage');

    await vineFetch.responseRecommendations(request, response);

    expect(sendMessageSpy).toHaveBeenCalledWith({
      "text": "1 variation(s) fixed.",
      "type": "infiniteWheelFixed",
    });
  });

  test('responseRecommendations should send etv', async () => {
    const request: [RequestInfo, RequestInit] = ['api/recommendations', { method: 'GET' }];
    const response = new Response(JSON.stringify({ result: { asin: '12345', taxValue: 1.45 } }));

    const sendMessageSpy = vi.spyOn(browser.runtime, 'sendMessage');

    await vineFetch.responseRecommendations(request, response);

    expect(sendMessageSpy).toHaveBeenCalledWith({
      "data": {
        "asin": "12345",
        "etv": 1.45,
        "parent_asin": null,
      },
      "type": "etv",
    });
  });
});