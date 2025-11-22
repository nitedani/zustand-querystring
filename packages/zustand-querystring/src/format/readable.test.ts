import { describe, it, expect } from 'vitest';
import { stringify, parse } from './readable';

// Helper to run tests in both modes
function testBothModes(name: string, testFn: (standalone: boolean) => void) {
  it(`${name} (normal mode)`, () => testFn(false));
  it(`${name} (standalone mode)`, () => testFn(true));
}

describe('readable format', () => {
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
});
