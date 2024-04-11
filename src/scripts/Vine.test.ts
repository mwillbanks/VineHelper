import { expect, test, describe, beforeEach } from 'vitest'
import { Vine, TypeVineQueue, vineQueueToProductQueue } from './Vine';

describe('Vine', () => {
  let vine: Vine;

  beforeEach(() => {
    vine = new Vine();
  });

  test('should initialize with default values', () => {
    expect(vine.code).toBe('US');
    expect(vine.country).toBe('US');
    expect(vine.currency).toBe('USD');
    expect(vine.domain).toBe('amazon.com');
    expect(vine.language).toBe(window.navigator.language);
    expect(vine.url).toBe('https://www.amazon.com');
    expect(vine.queue).toBe('com');
  });

  test('should format currency amount', () => {
    expect(vine.formatCurrency(10)).toBe('$10.00');
    expect(vine.formatCurrency('20.5')).toBe('$20.50');
  });

  test('should format date string', () => {
    const dateString = '2022-01-01T00:00:00';
    expect(vine.formatDate(dateString)).toBe('1/1/2022, 12:00:00 AM');
  });

  test('should format time ago string', () => {
    const dateString = (new Date()).toISOString();
    expect(vine.formatTimeAgo(dateString)).toBe('0m');
  });
});

describe('vineQueueToProductQueue', () => {
  test('should map vine queue to product queue', () => {
    expect(vineQueueToProductQueue[TypeVineQueue.encore]).toBe('AI');
    expect(vineQueueToProductQueue[TypeVineQueue.last_chance]).toBe('AFA');
    expect(vineQueueToProductQueue[TypeVineQueue.potluck]).toBe('RFY');
  });
});