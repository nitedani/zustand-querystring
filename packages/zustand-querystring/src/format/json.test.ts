import { describe, it, expect } from 'vitest';
import { json } from './json';

describe('json format', () => {
  describe('round-trip (namespaced)', () => {
    it('should round-trip simple objects', () => {
      const obj = { name: 'John', age: 30 };
      const encoded = json.stringify(obj);
      expect(json.parse(encoded)).toEqual(obj);
    });

    it('should round-trip nested objects', () => {
      const obj = { user: { name: 'John', settings: { theme: 'dark' } } };
      const encoded = json.stringify(obj);
      expect(json.parse(encoded)).toEqual(obj);
    });

    it('should round-trip arrays', () => {
      const obj = { tags: ['a', 'b', 'c'], numbers: [1, 2, 3] };
      const encoded = json.stringify(obj);
      expect(json.parse(encoded)).toEqual(obj);
    });

    it('should round-trip null values', () => {
      const obj = { value: null };
      const encoded = json.stringify(obj);
      expect(json.parse(encoded)).toEqual(obj);
    });

    it('should round-trip boolean values', () => {
      const obj = { enabled: true, disabled: false };
      const encoded = json.stringify(obj);
      expect(json.parse(encoded)).toEqual(obj);
    });

    it('should round-trip empty object', () => {
      const obj = {};
      const encoded = json.stringify(obj);
      expect(json.parse(encoded)).toEqual(obj);
    });

    it('should round-trip complex objects', () => {
      const obj = {
        user: { name: 'John', age: 30 },
        tags: ['a', 'b', 'c'],
        settings: { theme: 'dark', notifications: true },
        count: 42,
        active: false,
        nothing: null,
      };
      const encoded = json.stringify(obj);
      expect(json.parse(encoded)).toEqual(obj);
    });

    it('should round-trip special characters', () => {
      const obj = { text: 'hello, world!', path: 'a/b/c', query: 'foo=bar&baz=qux' };
      const encoded = json.stringify(obj);
      expect(json.parse(encoded)).toEqual(obj);
    });

    it('should round-trip unicode characters', () => {
      const obj = { text: '你好世界', emoji: '🎉🚀' };
      const encoded = json.stringify(obj);
      expect(json.parse(encoded)).toEqual(obj);
    });
  });

  describe('round-trip (standalone)', () => {
    it('should round-trip simple objects', () => {
      const obj = { name: 'John', age: 30, enabled: true };
      const params = json.stringifyStandalone(obj);
      const result = json.parseStandalone(params, { initialState: {} });
      expect(result).toEqual(obj);
    });

    it('should round-trip nested objects', () => {
      const obj = { user: { name: 'John', settings: { theme: 'dark' } } };
      const params = json.stringifyStandalone(obj);
      const result = json.parseStandalone(params, { initialState: {} });
      expect(result).toEqual(obj);
    });

    it('should round-trip arrays', () => {
      const obj = { tags: ['a', 'b', 'c'], numbers: [1, 2, 3] };
      const params = json.stringifyStandalone(obj);
      const result = json.parseStandalone(params, { initialState: {} });
      expect(result).toEqual(obj);
    });

    it('should round-trip null values', () => {
      const obj = { value: null };
      const params = json.stringifyStandalone(obj);
      const result = json.parseStandalone(params, { initialState: {} });
      expect(result).toEqual(obj);
    });

    it('should round-trip complex objects', () => {
      const obj = {
        user: { name: 'John', age: 30 },
        tags: ['a', 'b', 'c'],
        settings: { theme: 'dark', notifications: true },
      };
      const params = json.stringifyStandalone(obj);
      const result = json.parseStandalone(params, { initialState: {} });
      expect(result).toEqual(obj);
    });

    it('should round-trip special characters', () => {
      const obj = { text: 'hello, world!', path: 'a/b/c', query: 'foo=bar&baz=qux' };
      const params = json.stringifyStandalone(obj);
      const result = json.parseStandalone(params, { initialState: {} });
      expect(result).toEqual(obj);
    });

    it('should round-trip unicode characters', () => {
      const obj = { text: '你好世界', emoji: '🎉🚀' };
      const params = json.stringifyStandalone(obj);
      const result = json.parseStandalone(params, { initialState: {} });
      expect(result).toEqual(obj);
    });
  });

  describe('parseStandalone edge cases', () => {
    it('should skip invalid JSON values', () => {
      const params = {
        valid: [encodeURIComponent('"hello"')],
        invalid: ['not-valid-json'],
      };
      const result = json.parseStandalone(params, { initialState: {} });
      expect(result).toEqual({ valid: 'hello' });
    });
  });
});
