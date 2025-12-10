import { describe, it, expect } from 'vitest';
import { stringify, parse, marked, createFormat, type MarkedFormatOptions } from './marked';

// Helper to run tests in both modes
function testBothModes(name: string, testFn: (standalone: boolean) => void) {
  it(`${name} (normal mode)`, () => testFn(false));
  it(`${name} (standalone mode)`, () => testFn(true));
}

describe('marked format', () => {
  describe('primitives in objects', () => {
    testBothModes('should handle numbers', standalone => {
      const obj = { value: 42 };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);

      const obj2 = { zero: 0 };
      const encoded2 = stringify(obj2, standalone);
      expect(parse(encoded2, standalone)).toEqual(obj2);

      const obj3 = { negative: -123.45 };
      const encoded3 = stringify(obj3, standalone);
      expect(parse(encoded3, standalone)).toEqual(obj3);
    });

    testBothModes('should handle booleans', standalone => {
      const obj = { isTrue: true, isFalse: false };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle null', standalone => {
      const obj = { value: null };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle strings', standalone => {
      const obj = { message: 'hello', empty: '' };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes(
      'should handle strings with special characters',
      standalone => {
        const obj = { text: 'hello world', path: 'a/b' };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );
  });

  describe('objects', () => {
    testBothModes('should handle simple objects', standalone => {
      const obj = { name: 'John', age: 30 };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle nested objects', standalone => {
      const obj = { user: { name: 'John', settings: { theme: 'dark' } } };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes(
      'should handle objects with special characters in keys',
      standalone => {
        const obj = { 'my.key': 'value', another$key: 123 };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );

    testBothModes(
      'should handle objects with special characters in values',
      standalone => {
        const obj = { url: 'https://example.com?foo=bar', path: 'a/b/c' };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );

    testBothModes(
      'should handle string with comma and space',
      standalone => {
        const obj = { text: 'hello, world' };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );

    testBothModes('should handle empty objects', standalone => {
      const obj = {};
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should skip undefined values', standalone => {
      const obj = { a: 1, b: undefined, c: 2 };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual({ a: 1, c: 2 });
    });

    testBothModes('should skip function values', standalone => {
      const obj = { a: 1, b: () => {}, c: 2 };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual({ a: 1, c: 2 });
    });
  });

  describe('arrays in objects', () => {
    testBothModes('should handle simple arrays', standalone => {
      const obj = { items: [1, 2, 3] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle mixed type arrays', standalone => {
      const obj = { items: [1, 'hello', true, null] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle nested arrays', standalone => {
      const obj = { items: [1, [2, 3], [4, [5, 6]]] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle arrays with objects', standalone => {
      const obj = {
        users: [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ],
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle empty arrays', standalone => {
      const obj = { items: [] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle arrays with undefined', standalone => {
      const obj = { items: [1, undefined, 3] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual({ items: [1, undefined, 3] });
    });
  });

  describe('dates', () => {
    testBothModes('should handle Date objects', standalone => {
      const date = new Date('2024-01-15T12:30:00.000Z');
      const obj = { created: date };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.created).toBeInstanceOf(Date);
      expect(parsed.created.toISOString()).toBe(date.toISOString());
    });

    testBothModes('should handle dates in objects', standalone => {
      const obj = {
        created: new Date('2024-01-15T12:30:00.000Z'),
        updated: new Date('2024-01-16T12:30:00.000Z'),
      };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.created).toBeInstanceOf(Date);
      expect(parsed.created.toISOString()).toBe(obj.created.toISOString());
      expect(parsed.updated.toISOString()).toBe(obj.updated.toISOString());
    });
  });

  describe('complex structures', () => {
    testBothModes('should handle deeply nested structures', standalone => {
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
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;

      expect(parsed.user.id).toBe(123);
      expect(parsed.user.profile.name).toBe('John Doe');
      expect(parsed.user.profile.settings.theme).toBe('dark');
      expect(parsed.user.posts).toHaveLength(2);
      expect(parsed.user.posts[0].tags).toEqual(['javascript', 'typescript']);
      expect(parsed.metadata.created).toBeInstanceOf(Date);
      expect(parsed.metadata.version).toBe(1.5);
    });

    testBothModes('should handle zustand state example', standalone => {
      const state = {
        count: 5,
        someNestedState: {
          nestedCount: 10,
          hello: 'World',
        },
      };
      const encoded = stringify(state, standalone);
      expect(parse(encoded, standalone)).toEqual(state);
    });

    testBothModes(
      'should handle objects with dots and special chars',
      standalone => {
        const obj = {
          'key.with.dots': 'value',
          key$with$dollars: 123,
          'key:with:colons': true,
          'key@with@at': ['array', 'values'],
        };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );

    testBothModes(
      'should handle objects with equals signs in values',
      standalone => {
        const obj = {
          equation: 'a=b=c',
          url: 'http://example.com?foo=bar&baz=qux',
          comparison: '1==2',
        };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );
  });

  describe('edge cases', () => {
    testBothModes('should handle very long strings', standalone => {
      const longString = 'a'.repeat(1000);
      const obj = { long: longString };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle objects with many keys', standalone => {
      const obj: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        obj[`key${i}`] = i;
      }
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle deeply nested objects', standalone => {
      let obj: any = { value: 1 };
      for (let i = 0; i < 10; i++) {
        obj = { nested: obj };
      }
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle unicode characters', standalone => {
      const obj = {
        emoji: '🎉🚀',
        chinese: '你好',
        arabic: 'مرحبا',
        symbols: '™€£¥',
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle strings with double dots (..)', standalone => {
      const obj = {
        path: 'path..to..file',
        ellipsis: 'wait...',
        multiple: '.....',
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle strings with tilde (~)', standalone => {
      const obj = {
        home: '~/documents',
        approx: '~100',
        multiple: '~~~',
        mixed: 'a~b~c',
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle strings with colon (:)', standalone => {
      const obj = {
        time: '12:30:45',
        ratio: '16:9',
        protocol: 'https://example.com',
        multiple: ':::',
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle strings with at sign (@)', standalone => {
      const obj = {
        email: 'user@example.com',
        mention: '@username',
        multiple: '@@@',
        array: '@@array',
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle strings with dollar sign ($)', standalone => {
      const obj = {
        price: '$99.99',
        currency: 'USD$',
        multiple: '$$$',
        object: '$$object',
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle strings with equals sign (=)', standalone => {
      const obj = {
        equation: 'x=y',
        comparison: '===',
        assignment: 'a=b=c=d',
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes(
      'should handle strings with forward slash (/)',
      standalone => {
        const obj = {
          path: '/home/user/file',
          url: 'https://example.com/path/to/page',
          division: '10/5',
          multiple: '///',
        };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );

    testBothModes('should handle keys with special characters', standalone => {
      const obj = {
        'key..with..dots': 'value1',
        'key~with~tilde': 'value2',
        'key:with:colon': 'value3',
        'key@with@at': 'value4',
        key$with$dollar: 'value5',
        'key=with=equals': 'value6',
        'key/with/slash': 'value7',
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes(
      'should handle all special characters combined',
      standalone => {
        const obj = {
          crazy: '..~~::@@$$==//',
          mixed: '$@key:value=42..~end/',
          nested: {
            also: '..~~::@@$$',
          },
        };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );

    testBothModes(
      'should handle strings that look like encoded values',
      standalone => {
        const obj = {
          fakeNumber: ':123',
          fakeArray: '@item1..item2~',
          fakeObject: '$key:value~',
          fakeString: '=text',
        };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );

    testBothModes(
      'should handle empty strings in various positions',
      standalone => {
        const obj = {
          empty: '',
          array: ['', 'text', ''],
          nested: { inner: '' },
        };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );

    testBothModes(
      'should handle strings with newlines and tabs',
      standalone => {
        const obj = {
          multiline: 'line1\nline2\nline3',
          tabs: 'col1\tcol2\tcol3',
          mixed: 'text\n\twith\n\tformatting',
        };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );

    testBothModes('should handle numbers edge cases', standalone => {
      const obj = {
        zero: 0,
        infinity: Infinity,
        negInfinity: -Infinity,
        scientific: 1.23e-10,
        large: 9007199254740991,
      };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.zero).toBe(0);
      expect(parsed.infinity).toBe(Infinity);
      expect(parsed.negInfinity).toBe(-Infinity);
      expect(parsed.scientific).toBe(1.23e-10);
      expect(parsed.large).toBe(9007199254740991);
    });

    testBothModes('should preserve null values in objects', standalone => {
      const obj = {
        name: 'John',
        age: null,
        city: 'NYC',
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should preserve null in nested objects', standalone => {
      const obj = {
        user: {
          name: 'John',
          email: null,
        },
        count: 5,
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });
  });

  describe('comprehensive edge cases', () => {
    testBothModes('should handle arrays with dates', standalone => {
      const obj = {
        dates: [new Date('2024-01-15'), new Date('2024-12-25')],
      };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.dates).toHaveLength(2);
      expect(parsed.dates[0]).toBeInstanceOf(Date);
      expect(parsed.dates[0].toISOString()).toBe(obj.dates[0].toISOString());
    });

    testBothModes('should handle deeply nested arrays', standalone => {
      const obj = {
        deep: [
          [
            [1, 2],
            [3, 4],
          ],
          [
            [5, 6],
            [7, 8],
          ],
        ],
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle negative numbers', standalone => {
      const obj = { neg: -42, float: -3.14, negFloat: -123.456 };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle zero', standalone => {
      const obj = { zero: 0, negZero: -0 };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.zero).toBe(0);
      expect(parsed.negZero).toBe(0);
    });

    testBothModes('should handle very large numbers', standalone => {
      const obj = { big: 9007199254740991, small: -9007199254740991 };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle decimal numbers', standalone => {
      const obj = { pi: 3.14159, euler: 2.71828, tiny: 0.0001 };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.pi).toBeCloseTo(3.14159);
      expect(parsed.euler).toBeCloseTo(2.71828);
    });

    testBothModes('should handle mixed array with all types', standalone => {
      const obj = {
        mixed: [
          'string',
          42,
          true,
          false,
          null,
          undefined,
          new Date('2024-01-15'),
          { nested: 'obj' },
          [1, 2, 3],
        ],
      };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.mixed[0]).toBe('string');
      expect(parsed.mixed[1]).toBe(42);
      expect(parsed.mixed[2]).toBe(true);
      expect(parsed.mixed[3]).toBe(false);
      expect(parsed.mixed[4]).toBe(null);
      expect(parsed.mixed[5]).toBe(undefined);
      expect(parsed.mixed[6]).toBeInstanceOf(Date);
      expect(parsed.mixed[7]).toEqual({ nested: 'obj' });
      expect(parsed.mixed[8]).toEqual([1, 2, 3]);
    });

    testBothModes('should handle object with all value types', standalone => {
      const obj = {
        str: 'hello',
        num: 42,
        bool: true,
        nil: null,
        undef: undefined,
        date: new Date('2024-01-15'),
        arr: [1, 2, 3],
        obj: { nested: true },
      };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed).toEqual(obj);
    });

    testBothModes('should handle array of objects with dates', standalone => {
      const obj = {
        items: [
          { id: 1, created: new Date('2024-01-15') },
          { id: 2, created: new Date('2024-01-16') },
        ],
      };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.items[0].created).toBeInstanceOf(Date);
      expect(parsed.items[1].created).toBeInstanceOf(Date);
    });

    testBothModes(
      'should handle object in array in object in array',
      standalone => {
        const obj = {
          level1: [
            {
              level2: [
                {
                  level3: [1, 2, 3],
                },
              ],
            },
          ],
        };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );

    testBothModes('should handle trailing commas in arrays', standalone => {
      const obj = { arr: ['a', 'b', ''] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle leading empty string in array', standalone => {
      const obj = { arr: ['', 'a', 'b'] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes(
      'should handle multiple consecutive empty strings in array',
      standalone => {
        const obj = { arr: ['', '', 'text', '', ''] };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      },
    );

    testBothModes('should handle array with only empty strings', standalone => {
      const obj = { arr: ['', '', ''] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle strings that look like dates', standalone => {
      const obj = { fake: 'D1234567890', real: new Date(1234567890) };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.fake).toBe('D1234567890');
      expect(parsed.real).toBeInstanceOf(Date);
    });

    testBothModes(
      'should handle strings that look like numbers',
      standalone => {
        const obj = { str: '123', num: 123 };
        const encoded = stringify(obj, standalone);
        const parsed = parse(encoded, standalone) as typeof obj;
        expect(parsed.str).toBe('123');
        expect(parsed.num).toBe(123);
      },
    );

    testBothModes(
      'should handle strings that look like booleans',
      standalone => {
        const obj = { str: 'true', bool: true };
        const encoded = stringify(obj, standalone);
        const parsed = parse(encoded, standalone) as typeof obj;
        expect(parsed.str).toBe('true');
        expect(parsed.bool).toBe(true);
      },
    );

    testBothModes('should handle date at epoch', standalone => {
      const obj = { epoch: new Date(0) };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.epoch.getTime()).toBe(0);
    });

    testBothModes('should handle very old dates', standalone => {
      const obj = { old: new Date('1900-01-01') };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.old).toBeInstanceOf(Date);
    });

    testBothModes('should handle future dates', standalone => {
      const obj = { future: new Date('2099-12-31') };
      const encoded = stringify(obj, standalone);
      const parsed = parse(encoded, standalone) as typeof obj;
      expect(parsed.future).toBeInstanceOf(Date);
    });

    testBothModes('should handle empty object in array', standalone => {
      const obj = { arr: [{}, { a: 1 }, {}] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle empty array in object', standalone => {
      const obj = { a: [], b: [1], c: [] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle single element arrays', standalone => {
      const obj = {
        str: ['single'],
        num: [42],
        bool: [true],
        obj: [{ a: 1 }],
        arr: [[1]],
      };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes(
      'should handle numbers with many decimal places',
      standalone => {
        const obj = { precise: 3.141592653589793 };
        const encoded = stringify(obj, standalone);
        const parsed = parse(encoded, standalone) as typeof obj;
        expect(parsed.precise).toBeCloseTo(3.141592653589793);
      },
    );

    testBothModes('should preserve array order', standalone => {
      const obj = { arr: [5, 4, 3, 2, 1] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });

    testBothModes('should handle alternating types in array', standalone => {
      const obj = { arr: [1, 'a', 2, 'b', 3, 'c'] };
      const encoded = stringify(obj, standalone);
      expect(parse(encoded, standalone)).toEqual(obj);
    });
  });

  describe('standalone-specific tests', () => {
    testBothModes('should handle primitives', standalone => {
      if (standalone) {
        expect(parse(stringify('hello', true), true)).toBe('hello');
        expect(parse(stringify(42, true), true)).toBe(42);
        expect(parse(stringify(true, true), true)).toBe(true);
        expect(parse(stringify(null, true), true)).toBe(null);
        expect(parse(stringify(undefined, true), true)).toBe(undefined);
      }
    });

    testBothModes('should handle arrays', standalone => {
      if (standalone) {
        expect(parse(stringify(['a', 'b', 'c'], true), true)).toEqual([
          'a',
          'b',
          'c',
        ]);
        expect(parse(stringify([1, 2, 3], true), true)).toEqual([1, 2, 3]);
        expect(parse(stringify([], true), true)).toEqual([]);
      }
    });

    testBothModes('should handle dates', standalone => {
      if (standalone) {
        const date = new Date('2024-01-15');
        const parsed = parse(stringify(date, true), true) as Date;
        expect(parsed).toBeInstanceOf(Date);
        expect(parsed.getTime()).toBe(date.getTime());
      }
    });
  });

  describe('round-trip consistency', () => {
    const testCases = [
      { name: '', value: { a: 1, b: 'hello' } },
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
      testBothModes(`should round-trip ${name}`, standalone => {
        const encoded = stringify(value, standalone);
        const decoded = parse(encoded, standalone);
        expect(decoded).toEqual(value);
      });
    });
  });

  // Special tests that only make sense in normal mode
  describe('normal mode specific', () => {
    it('should handle simple objects with expected format', () => {
      const obj = { name: 'John', age: 30 };
      const encoded = stringify(obj);
      expect(encoded).toBe('name=John,age:30');
      expect(parse(encoded)).toEqual(obj);
    });

    it('should return :undefined for undefined', () => {
      expect(stringify(undefined)).toBe(':undefined');
    });

    it('should return empty string for functions', () => {
      expect(stringify(() => {})).toBe('');
    });
  });

  describe('standalone mode edge cases', () => {
    it('should parse plain string without marker in standalone mode', () => {
      // String without type marker in standalone mode
      const result = parse('hello', true);
      expect(result).toBe('hello');
    });

    it('should parse empty string in standalone mode', () => {
      // Empty string in standalone mode returns empty string
      const result = parse('', true);
      expect(result).toBe('');
    });

    it('should parse empty string in normal mode', () => {
      // Empty string in normal mode returns empty object
      const result = parse('', false);
      expect(result).toEqual({});
    });

    it('should parse date string in standalone mode', () => {
      // Date with D prefix in standalone mode
      const timestamp = Date.now();
      const result = parse(`D${timestamp}`, true);
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getTime()).toBe(timestamp);
    });

    it('should return string for invalid date in standalone mode', () => {
      // Invalid date format
      const result = parse('Dinvalid', true);
      expect(result).toBe('Dinvalid');
    });

    it('should parse date in string type value', () => {
      // Date with D prefix inside a string value
      const timestamp = Date.now();
      const result = parse(`=D${timestamp}`, false);
      expect(result).toBeInstanceOf(Date);
    });

    it('should not parse escaped date prefix as date', () => {
      // Escaped D prefix should keep the escape character
      const result = parse(`=\\D12345`, false);
      expect(result).toBe('\\D12345');
    });

    it('should handle escape at end of string', () => {
      // Escape char at end of string is kept as-is
      const result = parse('=hello\\', false);
      expect(result).toBe('hello\\');
    });

    it('should handle NaN timestamp in parseString', () => {
      // The isNaN check in parseString - timestamp that parses to NaN
      const result = parse(`=DNaN`, false);
      expect(result).toBe('DNaN');
    });

    it('should handle standalone mode with NaN timestamp', () => {
      // NaN timestamp in standalone mode goes to isNaN branch
      const result = parse('DNaN', true);
      expect(result).toBe('DNaN');
    });

    it('should detect object pattern in normal mode', () => {
      // String that matches object pattern (has key=value structure)
      const result = parse('name=John', false);
      expect(result).toEqual({ name: 'John' });
    });

    it('should detect string without object pattern in normal mode', () => {
      // String without key=value structure, treated as plain string
      const result = parse('hello world', false);
      expect(result).toBe('hello world');
    });

    it('should handle escape at very end of source in readUntil', () => {
      // Test the branch where pos >= source.length after advance
      const result = parse('=test\\', false);
      expect(result).toBe('test\\');
    });
  });

  describe('marked format object interface', () => {
    it('should export marked as QueryStringFormat', () => {
      expect(marked.stringify).toBeDefined();
      expect(marked.parse).toBeDefined();
      expect(marked.stringifyStandalone).toBeDefined();
      expect(marked.parseStandalone).toBeDefined();
    });

    it('should work with stringify and parse', () => {
      const state = { count: 5, name: 'test' };
      const str = marked.stringify(state);
      expect(marked.parse(str, { initialState: state })).toEqual(state);
    });

    describe('stringifyStandalone', () => {
      it('should return QueryStringParams format', () => {
        const state = { name: 'John', age: 30 };
        const result = marked.stringifyStandalone(state);
        expect(result).toEqual({
          name: ['John'],
          age: [':30'],
        });
      });

      it('should handle nested objects', () => {
        const state = { user: { name: 'John' } };
        const result = marked.stringifyStandalone(state);
        expect(result.user).toEqual(['.name=John']);
      });

      it('should handle arrays', () => {
        const state = { tags: ['a', 'b', 'c'] };
        const result = marked.stringifyStandalone(state);
        expect(result.tags).toEqual(['@a,b,c']);
      });

      it('should handle complex state', () => {
        const state = {
          search: 'test',
          page: 1,
          filters: { active: true },
        };
        const result = marked.stringifyStandalone(state);
        expect(result.search).toEqual(['test']);
        expect(result.page).toEqual([':1']);
        expect(result.filters).toEqual(['.active:true']);
      });
    });

    describe('parseStandalone', () => {
      it('should parse QueryStringParams format', () => {
        const params = {
          name: ['John'],
          age: [':30'],
        };
        const result = marked.parseStandalone(params, { initialState: {} });
        expect(result).toEqual({ name: 'John', age: 30 });
      });

      it('should handle nested objects', () => {
        const params = {
          user: ['.name=John'],
        };
        const result = marked.parseStandalone(params, { initialState: {} });
        expect(result).toEqual({ user: { name: 'John' } });
      });

      it('should handle arrays', () => {
        const params = {
          tags: ['@a,b,c'],
        };
        const result = marked.parseStandalone(params, { initialState: {} });
        expect(result).toEqual({ tags: ['a', 'b', 'c'] });
      });

      it('should handle empty values array', () => {
        const params = {
          empty: [],
          name: ['=John'],
        };
        const result = marked.parseStandalone(params, { initialState: {} });
        expect(result).toEqual({ name: 'John' });
      });

      it('should only use first value when multiple provided', () => {
        const params = {
          name: ['=John', '=Jane'],
        };
        const result = marked.parseStandalone(params, { initialState: {} });
        expect(result).toEqual({ name: 'John' });
      });
    });

    describe('round-trip standalone mode', () => {
      it('should round-trip simple objects', () => {
        const state = { name: 'John', age: 30, active: true };
        const params = marked.stringifyStandalone(state);
        const parsed = marked.parseStandalone(params, { initialState: {} });
        expect(parsed).toEqual(state);
      });

      it('should round-trip nested objects', () => {
        const state = { user: { name: 'John', settings: { theme: 'dark' } } };
        const params = marked.stringifyStandalone(state);
        const parsed = marked.parseStandalone(params, { initialState: {} });
        expect(parsed).toEqual(state);
      });

      it('should round-trip arrays', () => {
        const state = { tags: ['a', 'b', 'c'], numbers: [1, 2, 3] };
        const params = marked.stringifyStandalone(state);
        const parsed = marked.parseStandalone(params, { initialState: {} });
        expect(parsed).toEqual(state);
      });

      it('should round-trip complex state', () => {
        const state = {
          search: 'hello world',
          page: 1,
          filters: {
            categories: ['tech', 'science'],
            price: { min: 0, max: 100 },
          },
        };
        const params = marked.stringifyStandalone(state);
        const parsed = marked.parseStandalone(params, { initialState: {} });
        expect(parsed).toEqual(state);
      });
    });
  });

  // =============================================================================
  // NEW TESTS: CONFIGURABLE OPTIONS
  // =============================================================================

  describe('createFormat factory', () => {
    it('should create format with default options', () => {
      const format = createFormat();
      expect(format.stringify).toBeDefined();
      expect(format.parse).toBeDefined();
      expect(format.stringifyStandalone).toBeDefined();
      expect(format.parseStandalone).toBeDefined();
    });

    it('should produce same output as default marked', () => {
      const format = createFormat();
      const state = { name: 'John', count: 42, active: true };

      expect(format.stringify(state)).toBe(marked.stringify(state));
    });

    it('should round-trip with default options', () => {
      const format = createFormat();
      const state = {
        user: { name: 'Alice', age: 30 },
        tags: ['a', 'b', 'c'],
        active: true,
      };

      const str = format.stringify(state);
      expect(format.parse(str)).toEqual(state);
    });
  });

  describe('custom options', () => {
    describe('custom type markers', () => {
      it('should use custom typeObject marker', () => {
        const opts: MarkedFormatOptions = { typeObject: '$' };
        const state = { nested: { value: 1 } };
        const encoded = stringify(state, false, opts);

        expect(encoded).toContain('$');
        expect(parse(encoded, false, opts)).toEqual(state);
      });

      it('should use custom typeArray marker', () => {
        const opts: MarkedFormatOptions = { typeArray: '#' };
        const state = { items: [1, 2, 3] };
        const encoded = stringify(state, false, opts);

        expect(encoded).toContain('#');
        expect(parse(encoded, false, opts)).toEqual(state);
      });

      it('should use custom typeString marker', () => {
        const opts: MarkedFormatOptions = { typeString: '*' };
        const state = { message: 'hello' };
        const encoded = stringify(state, false, opts);

        expect(encoded).toContain('*');
        expect(parse(encoded, false, opts)).toEqual(state);
      });

      it('should use custom typePrimitive marker', () => {
        const opts: MarkedFormatOptions = { typePrimitive: '!' };
        const state = { count: 42, active: true };
        const encoded = stringify(state, false, opts);

        expect(encoded).toContain('!');
        expect(parse(encoded, false, opts)).toEqual(state);
      });
    });

    describe('custom separators', () => {
      it('should use custom separator', () => {
        const opts: MarkedFormatOptions = { separator: ';' };
        const state = { a: 1, b: 2, c: 3 };
        const encoded = stringify(state, false, opts);

        expect(encoded).toContain(';');
        expect(encoded).not.toContain(',');
        expect(parse(encoded, false, opts)).toEqual(state);
      });

      it('should use custom terminator', () => {
        const opts: MarkedFormatOptions = { terminator: '!' };
        const state = { nested: { deep: 1 }, sibling: 2 };
        const encoded = stringify(state, false, opts);

        expect(encoded).toContain('!');
        expect(parse(encoded, false, opts)).toEqual(state);
      });

      it('should use custom escape character', () => {
        const opts: MarkedFormatOptions = { escapeChar: '\\' };
        const state = { 'key.with.dots': 'value' };
        const encoded = stringify(state, false, opts);

        expect(parse(encoded, false, opts)).toEqual(state);
      });
    });

    describe('custom date prefix', () => {
      it('should use custom date prefix', () => {
        const opts: MarkedFormatOptions = { datePrefix: 'T' };
        const date = new Date('2024-01-15T12:00:00.000Z');
        const state = { created: date };
        const encoded = stringify(state, false, opts);

        expect(encoded).toContain('T');
        const parsed = parse(encoded, false, opts) as typeof state;
        expect(parsed.created).toBeInstanceOf(Date);
        expect(parsed.created.getTime()).toBe(date.getTime());
      });

      it('should handle date prefix in standalone mode', () => {
        const opts: MarkedFormatOptions = { datePrefix: 'DT' };
        const date = new Date('2024-01-15T12:00:00.000Z');
        const encoded = stringify(date, true, opts);

        expect(encoded).toContain('DT');
        const parsed = parse(encoded, true, opts);
        expect(parsed).toBeInstanceOf(Date);
        expect((parsed as Date).getTime()).toBe(date.getTime());
      });
    });

    describe('fully custom format', () => {
      const customOpts: MarkedFormatOptions = {
        typeObject: '$',
        typeArray: '#',
        typeString: '*',
        typePrimitive: '!',
        separator: ';',
        terminator: '|',
        escapeChar: '\\',
        datePrefix: 'T',
      };

      it('should round-trip simple objects', () => {
        const state = { name: 'John', age: 30 };
        const encoded = stringify(state, false, customOpts);
        expect(parse(encoded, false, customOpts)).toEqual(state);
      });

      it('should round-trip complex nested structures', () => {
        const state = {
          user: {
            name: 'Alice',
            tags: ['admin', 'user'],
            settings: { theme: 'dark', notifications: true },
          },
          count: 42,
          created: new Date('2024-01-15'),
        };
        const encoded = stringify(state, false, customOpts);
        const parsed = parse(encoded, false, customOpts) as typeof state;

        expect(parsed.user.name).toBe('Alice');
        expect(parsed.user.tags).toEqual(['admin', 'user']);
        expect(parsed.user.settings).toEqual({ theme: 'dark', notifications: true });
        expect(parsed.count).toBe(42);
        expect(parsed.created).toBeInstanceOf(Date);
      });

      it('should handle special characters in values', () => {
        const state = {
          'key$with$dollar': 'value;with;semicolons',
          'key#with#hash': 'value|with|pipes',
        };
        const encoded = stringify(state, false, customOpts);
        expect(parse(encoded, false, customOpts)).toEqual(state);
      });

      it('should work with createFormat', () => {
        const format = createFormat(customOpts);
        const state = { items: [1, 2, 3], active: true };

        const str = format.stringify(state);
        expect(format.parse(str)).toEqual(state);
      });

      it('should work with stringifyStandalone/parseStandalone', () => {
        const format = createFormat(customOpts);
        const state = {
          search: 'test query',
          page: 1,
          filters: { active: true },
        };

        const params = format.stringifyStandalone(state);
        const parsed = format.parseStandalone(params, { initialState: {} });
        expect(parsed).toEqual(state);
      });
    });
  });

  describe('option validation', () => {
    it('should throw on duplicate tokens', () => {
      expect(() => createFormat({ typeObject: '@', typeArray: '@' })).toThrow(
        /duplicate/i,
      );
    });

    it('should throw on empty tokens', () => {
      expect(() => createFormat({ separator: '' })).toThrow(/non-empty/i);
      expect(() => createFormat({ terminator: '' })).toThrow(/non-empty/i);
      expect(() => createFormat({ escapeChar: '' })).toThrow(/non-empty/i);
    });

    it('should throw on empty datePrefix', () => {
      expect(() => createFormat({ datePrefix: '' })).toThrow(/non-empty/i);
    });

    it('should throw when datePrefix conflicts with other tokens', () => {
      expect(() => createFormat({ datePrefix: '.' })).toThrow(/conflicts/i);
      expect(() => createFormat({ datePrefix: '@' })).toThrow(/conflicts/i);
    });
  });

  describe('format compatibility', () => {
    it('should not be compatible between different configurations', () => {
      const format1 = createFormat({ separator: ',' });
      const format2 = createFormat({ separator: ';' });

      const state = { a: 1, b: 2 };
      const encoded1 = format1.stringify(state);

      // Parsing with different config should not produce same result
      const parsed2 = format2.parse(encoded1);
      expect(parsed2).not.toEqual(state);
    });

    it('should preserve original default tokens in values when using custom config', () => {
      const customFormat = createFormat({
        separator: ';',
        terminator: '|',
      });

      // Values containing original default characters should work
      const state = { message: 'hello,world~test' };
      const encoded = customFormat.stringify(state);
      expect(customFormat.parse(encoded)).toEqual(state);
    });
  });

  describe('edge cases with custom options', () => {
    it('should handle multi-character tokens', () => {
      const opts: MarkedFormatOptions = {
        typeObject: '{{',
        typeArray: '[[',
        separator: '||',
        terminator: '}}',
        escapeChar: '%%',
      };

      const state = { nested: { items: [1, 2, 3] } };
      const encoded = stringify(state, false, opts);
      expect(parse(encoded, false, opts)).toEqual(state);
    });

    it('should handle values containing custom tokens', () => {
      const opts: MarkedFormatOptions = { separator: '|' };
      const state = { text: 'pipe|in|value' };
      const encoded = stringify(state, false, opts);
      expect(parse(encoded, false, opts)).toEqual(state);
    });

    it('should handle dates with string that matches custom date prefix', () => {
      const opts: MarkedFormatOptions = { datePrefix: 'TIME' };
      const state = {
        fake: 'TIME1234567890',
        real: new Date(1234567890),
      };
      const encoded = stringify(state, false, opts);
      const parsed = parse(encoded, false, opts) as typeof state;

      expect(parsed.fake).toBe('TIME1234567890');
      expect(parsed.real).toBeInstanceOf(Date);
    });
  });

  describe('URI encoding', () => {
    describe('should properly encode special characters in values', () => {
      testBothModes('space in string value', (standalone) => {
        const obj = { text: 'hello world' };
        const encoded = stringify(obj, standalone);
        expect(encoded).toContain('%20');
        expect(parse(encoded, standalone)).toEqual(obj);
      });

      testBothModes('accented characters in string value', (standalone) => {
        const obj = { text: 'café' };
        const encoded = stringify(obj, standalone);
        expect(encoded).toContain('%C3%A9'); // é encoded
        expect(parse(encoded, standalone)).toEqual(obj);
      });

      testBothModes('Hungarian characters', (standalone) => {
        const obj = { text: 'árvíztűrő tükörfúrógép' };
        const encoded = stringify(obj, standalone);
        expect(encoded).toContain('%C3%A1'); // á encoded
        expect(parse(encoded, standalone)).toEqual(obj);
      });

      testBothModes('emoji in string value', (standalone) => {
        const obj = { text: '👋🌍' };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      });

      testBothModes('Chinese characters', (standalone) => {
        const obj = { text: '你好世界' };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      });
    });

    describe('should properly encode special characters in keys', () => {
      testBothModes('space in key', (standalone) => {
        const obj = { 'hello world': 'value' };
        const encoded = stringify(obj, standalone);
        expect(encoded).toContain('%20');
        expect(parse(encoded, standalone)).toEqual(obj);
      });

      testBothModes('accented characters in key', (standalone) => {
        const obj = { café: 'coffee' };
        const encoded = stringify(obj, standalone);
        expect(encoded).toContain('%C3%A9'); // é encoded
        expect(parse(encoded, standalone)).toEqual(obj);
      });

      testBothModes('Hungarian characters in key', (standalone) => {
        const obj = { árvíz: 'flood' };
        const encoded = stringify(obj, standalone);
        expect(encoded).toContain('%C3%A1'); // á encoded
        expect(parse(encoded, standalone)).toEqual(obj);
      });
    });

    describe('should properly encode in arrays', () => {
      testBothModes('space in array element', (standalone) => {
        const obj = { items: ['hello world', 'foo bar'] };
        const encoded = stringify(obj, standalone);
        expect(encoded).toContain('%20');
        expect(parse(encoded, standalone)).toEqual(obj);
      });

      testBothModes('accented characters in array', (standalone) => {
        const obj = { items: ['café', 'naïve', 'résumé'] };
        const encoded = stringify(obj, standalone);
        expect(parse(encoded, standalone)).toEqual(obj);
      });
    });

    describe('should properly encode in nested objects', () => {
      testBothModes('space in nested value', (standalone) => {
        const obj = { nested: { text: 'hello world' } };
        const encoded = stringify(obj, standalone);
        expect(encoded).toContain('%20');
        expect(parse(encoded, standalone)).toEqual(obj);
      });

      testBothModes('space in nested key', (standalone) => {
        const obj = { nested: { 'hello world': 'value' } };
        const encoded = stringify(obj, standalone);
        expect(encoded).toContain('%20');
        expect(parse(encoded, standalone)).toEqual(obj);
      });
    });

    describe('output should be valid URL component', () => {
      testBothModes('encoded output should not contain raw spaces', (standalone) => {
        const obj = { 'key with space': 'value with space', arr: ['item with space'] };
        const encoded = stringify(obj, standalone);
        expect(encoded).not.toContain(' ');
        expect(parse(encoded, standalone)).toEqual(obj);
      });

      testBothModes('should round-trip through URL', (standalone) => {
        const obj = { text: 'hello world', key: 'árvíztűrő' };
        const encoded = stringify(obj, standalone);
        
        // Simulate URL param round-trip
        const url = new URL('http://example.com');
        url.searchParams.set('state', encoded);
        const fromUrl = url.searchParams.get('state')!;
        
        expect(parse(fromUrl, standalone)).toEqual(obj);
      });
    });

    describe('stringifyStandalone should encode keys for URL safety', () => {
      it('should encode space in key', () => {
        const state = { 'key with space': 'value' };
        const params = marked.stringifyStandalone(state);
        const keys = Object.keys(params);
        
        expect(keys[0]).toBe('key%20with%20space');
        expect(keys[0]).not.toContain(' ');
      });

      it('should encode accented characters in key', () => {
        const state = { café: 'coffee' };
        const params = marked.stringifyStandalone(state);
        const keys = Object.keys(params);
        
        expect(keys[0]).toBe('caf%C3%A9');
        expect(keys[0]).not.toContain('é');
      });

      it('should encode Hungarian characters in key', () => {
        const state = { árvíz: 'flood' };
        const params = marked.stringifyStandalone(state);
        const keys = Object.keys(params);
        
        expect(keys[0]).toContain('%C3%A1'); // á encoded
      });

      it('should round-trip keys with special characters', () => {
        const state = { 'key with space': 'value', 'café': 'coffee', 'árvíz': 'flood' };
        const params = marked.stringifyStandalone(state);
        const parsed = marked.parseStandalone(params, { initialState: {} });
        
        expect(parsed).toEqual(state);
      });

      it('should produce URL-safe keys that can be used directly', () => {
        const state = { 'hello world': 'test value', nested: { deep: 1 } };
        const params = marked.stringifyStandalone(state);
        
        // All keys should be URL-safe (no raw spaces, no raw unicode)
        for (const key of Object.keys(params)) {
          expect(key).not.toMatch(/[\s\u0080-\uFFFF]/);
        }
        
        // Values should also be encoded
        for (const values of Object.values(params)) {
          for (const value of values) {
            expect(value).not.toContain(' ');
          }
        }
      });
    });
  });
});
