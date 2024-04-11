import { expect, test, describe, beforeEach, vi } from 'vitest';
import { Logger } from './Logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  test('log should log messages in debug mode', () => {
    // Enable debug mode
    window.DEBUG = 'vh';

    const logSpy = vi.spyOn(console, 'log');
    logger.log(1, 'info', 'This is a log message');

    expect(logSpy).toBeCalledTimes(1);
  });

  test('log should not log messages when not in debug mode', () => {
    // Disable debug mode
    window.DEBUG = '';

    const logSpy = vi.spyOn(console, 'log');
    logger.log(1, 'info', 'This is a log message');

    expect(logSpy).not.toHaveBeenCalled();
  });

  test('scope should create a sub logger with the specified scope', () => {
    const subLogger = logger.scope('sub');

    expect(subLogger.settings.name).toBe('sub');
    expect(subLogger.settings.parentNames).toEqual(['vh']);
  });
});