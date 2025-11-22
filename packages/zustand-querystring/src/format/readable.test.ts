import { describe, it, expect } from 'vitest';
import { stringify, parse } from './readable';

describe('readable format', () => {
  describe('primitives in objects', () => {
    it('should handle numbers', () => {
      const obj = { value: 42 };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);

      const obj2 = { zero: 0 };
      const encoded2 = stringify(obj2);
      expect(parse(encoded2)).toEqual(obj2);

      const obj3 = { negative: -123.45 };
      const encoded3 = stringify(obj3);
      expect(parse(encoded3)).toEqual(obj3);
    });

    it('should handle booleans', () => {
      const obj = { isTrue: true, isFalse: false };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle null', () => {
      const obj = { value: null };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle strings', () => {
      const obj = { message: 'hello', empty: '' };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle strings with special characters', () => {
      const obj = { text: 'hello world', path: 'a/b' };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });
  });

  describe('objects', () => {
    it('should handle simple objects', () => {
      const obj = { name: 'John', age: 30 };
      const encoded = stringify(obj);
      expect(encoded).toBe('name=John,age:30');
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle nested objects', () => {
      const obj = { user: { name: 'John', settings: { theme: 'dark' } } };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle objects with special characters in keys', () => {
      const obj = { 'my.key': 'value', another$key: 123 };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle objects with special characters in values', () => {
      const obj = { url: 'https://example.com?foo=bar', path: 'a/b/c' };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle empty objects', () => {
      const obj = {};
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should skip undefined values', () => {
      const obj = { a: 1, b: undefined, c: 2 };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual({ a: 1, c: 2 });
    });

    it('should skip function values', () => {
      const obj = { a: 1, b: () => {}, c: 2 };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual({ a: 1, c: 2 });
    });
  });

  describe('arrays in objects', () => {
    it('should handle simple arrays', () => {
      const obj = { items: [1, 2, 3] };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle mixed type arrays', () => {
      const obj = { items: [1, 'hello', true, null] };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle nested arrays', () => {
      const obj = { items: [1, [2, 3], [4, [5, 6]]] };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle arrays with objects', () => {
      const obj = {
        users: [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ],
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle empty arrays', () => {
      const obj = { items: [] };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle arrays with undefined', () => {
      const obj = { items: [1, undefined, 3] };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual({ items: [1, undefined, 3] });
    });
  });

  describe('dates', () => {
    it('should handle Date objects', () => {
      const date = new Date('2024-01-15T12:30:00.000Z');
      const obj = { created: date };
      const encoded = stringify(obj);
      const parsed = parse(encoded) as typeof obj;
      expect(parsed.created).toBeInstanceOf(Date);
      expect(parsed.created.toISOString()).toBe(date.toISOString());
    });

    it('should handle dates in objects', () => {
      const obj = {
        created: new Date('2024-01-15T12:30:00.000Z'),
        updated: new Date('2024-01-16T12:30:00.000Z'),
      };
      const encoded = stringify(obj);
      const parsed = parse(encoded) as typeof obj;
      expect(parsed.created).toBeInstanceOf(Date);
      expect(parsed.created.toISOString()).toBe(obj.created.toISOString());
      expect(parsed.updated.toISOString()).toBe(obj.updated.toISOString());
    });
  });

  describe('complex structures', () => {
    it('should handle deeply nested structures', () => {
      const obj = {
        user: {
          id: 123,
          profile: {
            name: 'John Doe',
            email: 'john@example.com',
            settings: {
              notifications: true,
              theme: 'dark',
            },
          },
          posts: [
            { id: 1, title: 'First Post', tags: ['javascript', 'typescript'] },
            { id: 2, title: 'Second Post', tags: ['react', 'vue'] },
          ],
        },
        metadata: {
          created: new Date('2024-01-15T12:30:00.000Z'),
          version: 1.5,
        },
      };
      const encoded = stringify(obj);
      const parsed = parse(encoded) as typeof obj;

      expect(parsed.user.id).toBe(123);
      expect(parsed.user.profile.name).toBe('John Doe');
      expect(parsed.user.profile.settings.theme).toBe('dark');
      expect(parsed.user.posts).toHaveLength(2);
      expect(parsed.user.posts[0].tags).toEqual(['javascript', 'typescript']);
      expect(parsed.metadata.created).toBeInstanceOf(Date);
      expect(parsed.metadata.version).toBe(1.5);
    });

    it('should handle zustand state example', () => {
      const state = {
        count: 5,
        someNestedState: {
          nestedCount: 10,
          hello: 'World',
        },
      };
      const encoded = stringify(state);
      expect(parse(encoded)).toEqual(state);
    });

    it('should handle objects with dots and special chars', () => {
      const obj = {
        'key.with.dots': 'value',
        key$with$dollars: 123,
        'key:with:colons': true,
        'key@with@at': ['array', 'values'],
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle objects with equals signs in values', () => {
      const obj = {
        equation: 'a=b=c',
        url: 'http://example.com?foo=bar&baz=qux',
        comparison: '1==2',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });
  });

  describe('edge cases', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      const obj = { long: longString };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle objects with many keys', () => {
      const obj: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        obj[`key${i}`] = i;
      }
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle deeply nested objects', () => {
      let obj: any = { value: 1 };
      for (let i = 0; i < 10; i++) {
        obj = { nested: obj };
      }
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle unicode characters', () => {
      const obj = {
        emoji: '🎉🚀',
        chinese: '你好',
        arabic: 'مرحبا',
        symbols: '™€£¥',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should return empty string for undefined', () => {
      expect(stringify(undefined)).toBe(':undefined');
    });

    it('should return empty string for functions', () => {
      expect(stringify(() => {})).toBe('');
    });

    it('should handle strings with double dots (..)', () => {
      const obj = {
        path: 'path..to..file',
        ellipsis: 'wait...',
        multiple: '.....',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle strings with tilde (~)', () => {
      const obj = {
        home: '~/documents',
        approx: '~100',
        multiple: '~~~',
        mixed: 'a~b~c',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle strings with colon (:)', () => {
      const obj = {
        time: '12:30:45',
        ratio: '16:9',
        protocol: 'https://example.com',
        multiple: ':::',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle strings with at sign (@)', () => {
      const obj = {
        email: 'user@example.com',
        mention: '@username',
        multiple: '@@@',
        array: '@@array',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle strings with dollar sign ($)', () => {
      const obj = {
        price: '$99.99',
        currency: 'USD$',
        multiple: '$$$',
        object: '$$object',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle strings with equals sign (=)', () => {
      const obj = {
        equation: 'x=y',
        comparison: '===',
        assignment: 'a=b=c=d',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle strings with forward slash (/)', () => {
      const obj = {
        path: '/home/user/file',
        url: 'https://example.com/path/to/page',
        division: '10/5',
        multiple: '///',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle keys with special characters', () => {
      const obj = {
        'key..with..dots': 'value1',
        'key~with~tilde': 'value2',
        'key:with:colon': 'value3',
        'key@with@at': 'value4',
        key$with$dollar: 'value5',
        'key=with=equals': 'value6',
        'key/with/slash': 'value7',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle all special characters combined', () => {
      const obj = {
        crazy: '..~~::@@$$==//',
        mixed: '$@key:value=42..~end/',
        nested: {
          also: '..~~::@@$$',
        },
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle strings that look like encoded values', () => {
      const obj = {
        fakeNumber: ':123',
        fakeArray: '@item1..item2~',
        fakeObject: '$key:value~',
        fakeString: '=text',
        fakeDate: '=!Date:2024-01-01',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle empty strings in various positions', () => {
      const obj = {
        empty: '',
        array: ['', 'text', ''],
        nested: { inner: '' },
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle strings with newlines and tabs', () => {
      const obj = {
        multiline: 'line1\nline2\nline3',
        tabs: 'col1\tcol2\tcol3',
        mixed: 'text\n\twith\n\tformatting',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should handle numbers edge cases', () => {
      const obj = {
        zero: 0,
        infinity: Infinity,
        negInfinity: -Infinity,
        scientific: 1.23e-10,
        large: 9007199254740991, // MAX_SAFE_INTEGER
      };
      const encoded = stringify(obj);
      const parsed = parse(encoded) as typeof obj;
      expect(parsed.zero).toBe(0);
      expect(parsed.infinity).toBe(Infinity);
      expect(parsed.negInfinity).toBe(-Infinity);
      expect(parsed.scientific).toBe(1.23e-10);
      expect(parsed.large).toBe(9007199254740991);
    });

    it('should preserve null values in objects', () => {
      const obj = {
        name: 'John',
        age: null,
        city: 'NYC',
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });

    it('should preserve null in nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          email: null,
        },
        count: 5,
      };
      const encoded = stringify(obj);
      expect(parse(encoded)).toEqual(obj);
    });
  });

  describe('round-trip consistency', () => {
    const testCases = [
      { name: 'simple object', value: { a: 1, b: 'hello' } },
      { name: 'nested object', value: { a: { b: { c: 'deep' } } } },
      { name: 'array in object', value: { items: [1, 2, 3] } },
      {
        name: 'mixed array in object',
        value: { items: [1, 'two', true, null, { four: 4 }] },
      },
      {
        name: 'complex',
        value: { users: [{ id: 1, name: 'Alice' }], count: 42 },
      },
      { name: 'with date', value: { created: new Date('2024-01-15') } },
      { name: 'empty', value: {} },
    ];

    testCases.forEach(({ name, value }) => {
      it(`should round-trip ${name}`, () => {
        const encoded = stringify(value);
        const decoded = parse(encoded);
        expect(decoded).toEqual(value);
      });
    });
  });
});
