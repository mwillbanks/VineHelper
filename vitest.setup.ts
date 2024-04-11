import { fakeBrowser } from '@webext-core/fake-browser';
import { localExtStorage } from '@webext-core/storage';
import { vi } from 'vitest';

vi.mock("webextension-polyfill", () => ({ default: fakeBrowser, ...fakeBrowser }));