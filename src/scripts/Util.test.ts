import { expect, test, describe, beforeEach, vi } from 'vitest'
import browser from "webextension-polyfill";
import { Logger } from './Logger';
import { Util } from './Util';

vi.mock('./Logger');

describe('Util', () => {
  let util: Util;

  beforeEach(() => {
    const logger = new Logger();
    logger.scope = vi.fn().mockReturnValue(logger);
    util = new Util({ logger });
  });

  test('arrayUnique should remove duplicates from an array', () => {
    const arr = [1, 2, 3, 2, 4, 1, 5];
    const result = util.arrayUnique(arr);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  test('decodeHtmlEntities should decode named HTML entities in a string', () => {
    const str = '&lt;div&gt;&amp;&nbsp;&copy;&reg;&cent;&pound;&yen;&euro;';
    const result = util.decodeHtmlEntities(str);
    expect(result).toEqual('<div>& ©®¢£¥€');
  });

  test('decodeHtmlEntiries should decode unicode entiries in a string', () => {
    const str = '&#60;&#38;&#160;&#169;&#174;&#162;&#163;&#165;&#8364;';
    const result = util.decodeHtmlEntities(str);
    expect(result).toEqual('<& ©®¢£¥€');
  });

  test('decodeHtmlEntities should decode hex entities in a string', () => {
    const str = '&#x3c;&#x26;&#xa0;&#xa9;&#xae;&#xa2;&#xa3;&#xa5;&#x20ac;';
    const result = util.decodeHtmlEntities(str);
    expect(result).toEqual('<& ©®¢£¥€');
  });

  test('getLocalStorage should get the value of a key from local storage', async () => {
    const key = 'testKey';
    const existing = { foo: 'bar' };
    const data = { testKey: { baz: 'qux' } };
    const expected = { foo: 'bar', baz: 'qux' };

    vi.spyOn(browser.storage.local, 'get').mockResolvedValue(data);

    const result = await util.getLocalStorage(key, existing);
    expect(result).toEqual(expected);
    expect(browser.storage.local.get).toHaveBeenCalledWith(key);
  });

  test('setLocalStorage should set the value of a key in local storage', async () => {
    const key = 'testKey';
    const value = { foo: 'bar' };
    const data = { testKey: { foo: 'bar' } };

    vi.spyOn(browser.storage.local, 'set').mockResolvedValue(undefined);

    await util.setLocalStorage(key, value);
    expect(browser.storage.local.set).toHaveBeenCalledWith(data);
  });

  test('getType should return the type of an object', () => {
    const obj = { foo: 'bar' };
    const result = util.getType(obj);
    expect(result).toEqual('object');
  });

  test('objMerge should deep merge two objects', () => {
    const clone = { foo: 'bar' };
    const obj = { baz: 'qux' };
    const expected = { foo: 'bar', baz: 'qux' };

    util.objMerge(clone, obj);
    expect(clone).toEqual(expected);
  });

  test('deepMerge should deep merge multiple objects', () => {
    const obj1 = { foo: 'bar' };
    const obj2 = { baz: 'qux' };
    const obj3 = { foo: 'baz' };
    const expected = { foo: 'baz', baz: 'qux' };

    const result = util.deepMerge(obj1, obj2, obj3);
    expect(result).toEqual(expected);
  });

  test('deepFreeze should deep freeze an object', () => {
    const obj = { foo: { bar: 'baz' } };
    const result = util.deepFreeze(obj);
    expect(Object.isFrozen(result)).toBeTruthy();
    expect(Object.isFrozen(result.foo)).toBeTruthy();
  });

  test('objPropertySetDeep should set a property in an object using dot notation', () => {
    const obj = {};
    const key = 'foo.bar.baz';
    const value = 'qux';
    const expected = { foo: { bar: { baz: 'qux' } } };

    util.objPropertySetDeep(obj, key, value);
    expect(obj).toEqual(expected);
  });

  test('objPropertyGetDeep should get a property in an object using dot notation', () => {
    const obj = { foo: { bar: { baz: 'qux' } } };
    const key = 'foo.bar.baz';
    const defaultValue = 'default';
    const result = util.objPropertyGetDeep(obj, key, defaultValue);
    expect(result).toEqual('qux');
  });

  test('createElement should create an element with attributes', () => {
    const elementSpec = {
      tag: 'div',
      attributes: {
        id: 'myDiv',
        class: 'container',
        onclick: vi.fn(),
      },
      children: [
        {
          tag: 'span',
          attributes: {
            class: 'text',
            textContent: 'Hello World',
          },
        },
      ],
    };

    const element = util.createElement(elementSpec);
    expect(element.tagName).toEqual('DIV');
    expect(element.getAttribute('id')).toEqual('myDiv');
    expect(element.getAttribute('class')).toEqual('container');
    expect(element.onclick).toEqual(expect.any(Function));

    const spanElement = element.querySelector('span')!;
    expect(spanElement).not.toBeNull();
    expect(spanElement.tagName).toEqual('SPAN');
    expect(spanElement.getAttribute('class')).toEqual('text');
    expect(spanElement.textContent).toEqual('Hello World');
  });

  test('versionCompare should compare two version strings using semantic versioning', () => {
    expect(util.versionCompare('1.0.0', '1.0.0')).toEqual(0);
    expect(util.versionCompare('1.0.0', '1.0.1')).toEqual(-1);
    expect(util.versionCompare('1.0.1', '1.0.0')).toEqual(1);
    expect(util.versionCompare('1.0.0', '1.1.0')).toEqual(-1);
    expect(util.versionCompare('1.1.0', '1.0.0')).toEqual(1);
    expect(util.versionCompare('1.0.0', '2.0.0')).toEqual(-1);
    expect(util.versionCompare('2.0.0', '1.0.0')).toEqual(1);
  });
});