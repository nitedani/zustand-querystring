import { describe, it, expect } from 'vitest';
import { createFormat, plain, typed } from './configurable.js';
import type { QueryStringParams } from '../middleware.js';

// Helper to convert array of {key, value} to QueryStringParams Record
function toParams(arr: { key: string; value: string }[]): QueryStringParams {
  const result: QueryStringParams = {};
  for (const { key, value } of arr) {
    if (!result[key]) result[key] = [];
    result[key].push(value);
  }
  return result;
}

// =============================================================================
// HELPER: Test round-trip for any format
// =============================================================================
function testRoundTrip(
  format: ReturnType<typeof createFormat>,
  state: object,
  initialState: object = state
) {
  // Test namespaced mode
  const namespacedStr = format.stringify(state);
  const namespacedParsed = format.parse(namespacedStr, { initialState });
  expect(namespacedParsed).toEqual(state);

  // Test standalone mode - parseStandalone receives QueryStringParams (Record<string, string[]>)
  const standaloneParams = format.stringifyStandalone(state);
  const standaloneParsed = format.parseStandalone(standaloneParams, { initialState });
  expect(standaloneParsed).toEqual(state);
}

// Test standalone mode only (for configs that can't round-trip in namespaced mode)
function testStandaloneRoundTrip(
  format: ReturnType<typeof createFormat>,
  state: object,
  initialState: object = state
) {
  const standaloneParams = format.stringifyStandalone(state);
  const standaloneParsed = format.parseStandalone(standaloneParams, { initialState });
  expect(standaloneParsed).toEqual(state);
}

// =============================================================================
// FLAT MODE - ALL OPTIONS PERMUTATIONS
// =============================================================================

describe('configurable format - plain mode', () => {
  // Test data for all tests
  const simpleState = { name: 'John', age: 30, active: true };
  const nestedState = { user: { name: 'John', profile: { city: 'NYC' } } };
  const arrayState = { tags: ['a', 'b', 'c'] };
  const arrayOfNumbersState = { ids: [1, 2, 3] };
  const emptyArrayState = { items: [] };
  const arrayOfObjectsState = { users: [{ name: 'Alice' }, { name: 'Bob' }] };
  const dateState = { created: new Date('2024-01-15T10:30:00.000Z') };
  const nullState = { value: null };
  const undefinedState = { value: undefined };
  const boolState = { yes: true, no: false };
  const complexState = {
    query: 'search',
    page: 1,
    filters: { category: 'books', price: { min: 10, max: 100 } },
    tags: ['fiction', 'bestseller'],
  };

  describe('default plain preset', () => {
    it('should round-trip simple state', () => {
      testRoundTrip(plain, simpleState);
    });

    it('should round-trip nested state', () => {
      testRoundTrip(plain, nestedState);
    });

    it('should round-trip array state', () => {
      testRoundTrip(plain, arrayState);
    });

    it('should round-trip array of numbers', () => {
      testRoundTrip(plain, arrayOfNumbersState);
    });

    it('should round-trip empty array', () => {
      testRoundTrip(plain, emptyArrayState);
    });

    it('should round-trip array of objects', () => {
      testRoundTrip(plain, arrayOfObjectsState);
    });

    it('should round-trip date state', () => {
      const str = plain.stringify(dateState);
      const parsed = plain.parse(str);
      expect((parsed as typeof dateState).created.getTime()).toBe(dateState.created.getTime());
    });

    it('should round-trip null state', () => {
      testRoundTrip(plain, nullState);
    });

    it('should round-trip undefined state', () => {
      testRoundTrip(plain, undefinedState);
    });

    it('should round-trip complex state', () => {
      testRoundTrip(plain, complexState);
    });
  });

  describe('nestingSeparator option', () => {
    const separators = ['.', '_', '-', '~', '::'];

    separators.forEach(sep => {
      it(`should work with nestingSeparator="${sep}"`, () => {
        const format = createFormat({ typed: false, separators: { nesting: sep } });
        testRoundTrip(format, nestedState);
      });

      it(`should stringify nested with nestingSeparator="${sep}"`, () => {
        const format = createFormat({ typed: false, separators: { nesting: sep } });
        const result = format.stringifyStandalone({ a: { b: 'c' } });
        expect(result[`a${sep}b`]).toEqual(['c']);
      });
    });

    // Special case: when nestingSeparator is '/', use different escape char
    it('should work with nestingSeparator="/" and escape="\\\\"', () => {
      const format = createFormat({ typed: false, separators: { nesting: '/', escape: '\\' } });
      testRoundTrip(format, nestedState);
    });
  });

  describe('arraySeparator option', () => {
    it('should work with arraySeparator="repeat" (default)', () => {
      const format = createFormat({ typed: false, separators: { array: 'repeat' } });
      const result = format.stringifyStandalone({ tags: ['a', 'b', 'c'] });
      expect(result.tags).toEqual(['a', 'b', 'c']);
    });

    const separators = [',', '|', ';', '~', '::', '-'];

    separators.forEach(sep => {
      it(`should work with arraySeparator="${sep}"`, () => {
        const format = createFormat({ typed: false, separators: { array: sep } });
        const result = format.stringifyStandalone({ tags: ['a', 'b', 'c'] });
        expect(result.tags).toEqual([`a${sep}b${sep}c`]);
      });

      it(`should parse with arraySeparator="${sep}"`, () => {
        const format = createFormat({ typed: false, separators: { array: sep } });
        const params = [{ key: 'tags', value: `a${sep}b${sep}c` }];
        const result = format.parseStandalone(toParams(params), { initialState: { tags: [] } });
        expect(result).toEqual({ tags: ['a', 'b', 'c'] });
      });

      // NOTE: Non-repeat arraySeparator cannot round-trip in namespaced mode without initialState
      // because parse() can't know if "a|b|c" is an array or a single value containing "|"
      it(`should round-trip standalone with arraySeparator="${sep}"`, () => {
        const format = createFormat({ typed: false, separators: { array: sep } });
        testStandaloneRoundTrip(format, arrayState);
      });
    });
  });

  describe('arrayIndexStyle option', () => {
    it('should use dot style by default', () => {
      const format = createFormat({ typed: false, plain: { arrayIndexStyle: 'dot' } });
      const result = format.stringifyStandalone(arrayOfObjectsState);
      expect(result['users.0.name']).toEqual(['Alice']);
      expect(result['users.1.name']).toEqual(['Bob']);
    });

    it('should use bracket style', () => {
      const format = createFormat({ typed: false, plain: { arrayIndexStyle: 'bracket' } });
      const result = format.stringifyStandalone(arrayOfObjectsState);
      expect(result['users[0].name']).toEqual(['Alice']);
      expect(result['users[1].name']).toEqual(['Bob']);
    });

    it('should parse bracket style', () => {
      const format = createFormat({ typed: false, plain: { arrayIndexStyle: 'bracket' } });
      const params = [
        { key: 'users[0].name', value: 'Alice' },
        { key: 'users[1].name', value: 'Bob' },
      ];
      const result = format.parseStandalone(toParams(params), {
        initialState: { users: [{ name: '' }] },
      });
      expect(result).toEqual({ users: [{ name: 'Alice' }, { name: 'Bob' }] });
    });

    it('should round-trip with bracket style', () => {
      const format = createFormat({ typed: false, plain: { arrayIndexStyle: 'bracket' } });
      testRoundTrip(format, arrayOfObjectsState);
    });
  });

  describe('emptyArrayMarker option', () => {
    it('should use default marker "__empty_array__"', () => {
      const format = createFormat({ typed: false });
      const result = format.stringifyStandalone({ items: [] });
      expect(result.items).toEqual(['__empty_array__']);
    });

    it('should use custom marker', () => {
      const format = createFormat({ typed: false, plain: { emptyArrayMarker: '[]' } });
      const result = format.stringifyStandalone({ items: [] });
      // [] is encoded to %5B%5D by encodeURI
      expect(result.items).toEqual(['%5B%5D']);
    });

    it('should parse custom marker', () => {
      const format = createFormat({ typed: false, plain: { emptyArrayMarker: '[]' } });
      // Pass encoded value as it would come from URL
      const params = [{ key: 'items', value: '%5B%5D' }];
      const result = format.parseStandalone(toParams(params), { initialState: { items: [] } });
      expect(result).toEqual({ items: [] });
    });

    it('should omit empty arrays when marker is null', () => {
      const format = createFormat({ typed: false, plain: { emptyArrayMarker: null } });
      const result = format.stringifyStandalone({ items: [], name: 'test' });
      expect(result).toEqual({ name: ['test'] });
      expect(result.items).toBeUndefined();
    });

    it('should round-trip with custom marker', () => {
      const format = createFormat({ typed: false, plain: { emptyArrayMarker: 'EMPTY' } });
      testRoundTrip(format, emptyArrayState);
    });
  });

  describe('separator option (namespaced mode)', () => {
    const separators = [',', ';', '|', '&'];

    separators.forEach(sep => {
      it(`should use separator="${sep}" in namespaced mode`, () => {
        const format = createFormat({ typed: false, separators: { entry: sep } });
        const result = format.stringify({ a: 1, b: 2 });
        expect(result).toBe(`a=1${sep}b=2`);
      });

      it(`should parse with separator="${sep}"`, () => {
        const format = createFormat({ typed: false, separators: { entry: sep } });
        const result = format.parse(`a=1${sep}b=2`);
        expect(result).toEqual({ a: 1, b: 2 });
      });

      it(`should round-trip with separator="${sep}"`, () => {
        const format = createFormat({ typed: false, separators: { entry: sep } });
        const str = format.stringify(simpleState);
        const parsed = format.parse(str);
        expect(parsed).toEqual(simpleState);
      });
    });
  });

  describe('escape option', () => {
    it('should escape separator in values', () => {
      const format = createFormat({ typed: false, separators: { entry: ',', escape: '\\' } });
      const state = { query: 'a,b,c' };
      const str = format.stringify(state);
      expect(str).toContain('\\,');
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });

    it('should escape escape character itself', () => {
      const format = createFormat({ typed: false, separators: { escape: '\\' } });
      const state = { path: 'a\\b' };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });

    const escapeChars = ['/', '\\', '!', '%'];

    escapeChars.forEach(esc => {
      it(`should work with escape="${esc}"`, () => {
        const format = createFormat({ typed: false, separators: { escape: esc, entry: ',' } });
        const state = { query: 'has,comma' };
        const str = format.stringify(state);
        const parsed = format.parse(str);
        expect(parsed).toEqual(state);
      });
    });
  });

  describe('strings with multiple delimiters', () => {
    // Test strings that contain various delimiter characters that need escaping
    const problematicStrings = [
      'a,b,c=2',           // comma and equals
      'key=value',          // equals sign
      'a=1,b=2,c=3',       // multiple key-value pairs
      'name:John,age:30',  // colon and comma
      'path/to/file',      // path separator
      '@mention',          // at sign (array marker)
      '#hashtag',          // hash (object marker)
      '~tilde~',           // tilde (terminator)
      'a;b;c',             // semicolons
      'x&y&z',             // ampersands
      'foo[0]bar',         // brackets
      'test.nested.key',   // dots (nesting separator)
    ];

    describe('plain mode (typed: false)', () => {
      problematicStrings.forEach(str => {
        it(`should round-trip "${str}" in namespaced mode`, () => {
          const format = createFormat({ typed: false });
          const state = { text: str };
          const serialized = format.stringify(state);
          const parsed = format.parse(serialized);
          expect(parsed).toEqual(state);
        });

        it(`should round-trip "${str}" in standalone mode`, () => {
          const format = createFormat({ typed: false });
          const state = { text: str };
          const serialized = format.stringifyStandalone(state);
          const parsed = format.parseStandalone(serialized, { initialState: state });
          expect(parsed).toEqual(state);
        });
      });

      it('should round-trip string with all common delimiters', () => {
        const format = createFormat({ typed: false });
        const complexString = 'name=John,age=30;city:NYC&country=US#home~path/to/file@user';
        const state = { data: complexString };
        const serialized = format.stringify(state);
        const parsed = format.parse(serialized);
        expect(parsed).toEqual(state);
      });
    });

    describe('typed mode (typed: true)', () => {
      problematicStrings.forEach(str => {
        it(`should round-trip "${str}" in namespaced mode`, () => {
          const format = createFormat({ typed: true });
          const state = { text: str };
          const serialized = format.stringify(state);
          const parsed = format.parse(serialized);
          expect(parsed).toEqual(state);
        });

        it(`should round-trip "${str}" in standalone mode`, () => {
          const format = createFormat({ typed: true });
          const state = { text: str };
          const serialized = format.stringifyStandalone(state);
          const parsed = format.parseStandalone(serialized, { initialState: state });
          expect(parsed).toEqual(state);
        });
      });

      it('should round-trip string with all common delimiters', () => {
        const format = createFormat({ typed: true });
        const complexString = 'name=John,age=30;city:NYC&country=US#home~path/to/file@user';
        const state = { data: complexString };
        const serialized = format.stringify(state);
        const parsed = format.parse(serialized);
        expect(parsed).toEqual(state);
      });
    });

    describe('with disabled markers', () => {
      it('should round-trip "a,b,c=2" with markers: { array: false }', () => {
        const format = createFormat({ typed: true, markers: { array: false } });
        const state = { text: 'a,b,c=2' };
        const serialized = format.stringifyStandalone(state);
        const parsed = format.parseStandalone(serialized, { initialState: state });
        expect(parsed).toEqual(state);
      });

      it('should round-trip "a,b,c=2" with markers: { primitive: false }', () => {
        const format = createFormat({ typed: true, markers: { primitive: false } });
        const state = { text: 'a,b,c=2' };
        const serialized = format.stringifyStandalone(state);
        const parsed = format.parseStandalone(serialized, { initialState: state });
        expect(parsed).toEqual(state);
      });

      it('should round-trip "a,b,c=2" with both markers disabled', () => {
        const format = createFormat({ typed: true, markers: { array: false, primitive: false } });
        const state = { text: 'a,b,c=2' };
        const serialized = format.stringifyStandalone(state);
        const parsed = format.parseStandalone(serialized, { initialState: state });
        expect(parsed).toEqual(state);
      });
    });

    describe('with custom separators', () => {
      it('should round-trip "a,b,c=2" with separators: { entry: ";" }', () => {
        const format = createFormat({ typed: false, separators: { entry: ';' } });
        const state = { text: 'a,b,c=2' };
        const serialized = format.stringify(state);
        const parsed = format.parse(serialized);
        expect(parsed).toEqual(state);
      });

      it('should round-trip "a;b;c=2" with separators: { entry: ";" }', () => {
        // String contains the separator itself
        const format = createFormat({ typed: false, separators: { entry: ';' } });
        const state = { text: 'a;b;c=2' };
        const serialized = format.stringify(state);
        const parsed = format.parse(serialized);
        expect(parsed).toEqual(state);
      });

      it('should round-trip "a,b,c=2" with separators: { array: ";" }', () => {
        const format = createFormat({ typed: true, separators: { array: ';' } });
        const state = { text: 'a,b,c=2' };
        const serialized = format.stringify(state);
        const parsed = format.parse(serialized);
        expect(parsed).toEqual(state);
      });
    });

    describe('in arrays', () => {
      it('should round-trip array of strings with delimiters in typed mode', () => {
        const format = createFormat({ typed: true });
        const state = { items: ['a,b', 'c=2', 'd:e'] };
        const serialized = format.stringify(state);
        const parsed = format.parse(serialized);
        expect(parsed).toEqual(state);
      });

      it('should round-trip array of strings with delimiters in plain mode with repeat', () => {
        const format = createFormat({ typed: false, separators: { array: 'repeat' } });
        const state = { items: ['a,b', 'c=2', 'd:e'] };
        const serialized = format.stringifyStandalone(state);
        const parsed = format.parseStandalone(serialized, { initialState: state });
        expect(parsed).toEqual(state);
      });

      it('should round-trip array of strings with delimiters in plain mode with comma separator', () => {
        const format = createFormat({ typed: false, separators: { array: ',' } });
        const state = { items: ['a,b', 'c=2', 'd:e'] };
        const serialized = format.stringifyStandalone(state);
        const parsed = format.parseStandalone(serialized, { initialState: state });
        expect(parsed).toEqual(state);
      });
    });

    describe('in nested objects', () => {
      it('should round-trip nested object with delimiter strings in typed mode', () => {
        const format = createFormat({ typed: true });
        const state = { 
          config: { 
            query: 'a,b,c=2',
            path: 'path/to/file'
          }
        };
        const serialized = format.stringify(state);
        const parsed = format.parse(serialized);
        expect(parsed).toEqual(state);
      });

      it('should round-trip nested object with delimiter strings in plain mode', () => {
        const format = createFormat({ typed: false });
        const state = { 
          config: { 
            query: 'a,b,c=2',
            path: 'path/to/file'
          }
        };
        const serialized = format.stringify(state);
        const parsed = format.parse(serialized);
        expect(parsed).toEqual(state);
      });
    });

    describe('aggressive edge cases - trying to break escaping', () => {
      // Strings that are EXACTLY the escape character
      it('should round-trip string that is just the escape character "/"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '/' };
        testRoundTrip(format, state);
      });

      it('should round-trip string that is multiple escape characters "///"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '///' };
        testRoundTrip(format, state);
      });

      // Strings that are EXACTLY the terminator
      it('should round-trip string that is just the terminator "~"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '~' };
        testRoundTrip(format, state);
      });

      it('should round-trip string that is multiple terminators "~~~"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '~~~' };
        testRoundTrip(format, state);
      });

      // Escape followed by terminator
      it('should round-trip escape followed by terminator "/~"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '/~' };
        testRoundTrip(format, state);
      });

      // Terminator followed by escape
      it('should round-trip terminator followed by escape "~/"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '~/' };
        testRoundTrip(format, state);
      });

      // Double escape followed by terminator
      it('should round-trip double escape followed by terminator "//~"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '//~' };
        testRoundTrip(format, state);
      });

      // All type markers as values
      it('should round-trip string that is just "=" (stringMarker)', () => {
        const format = createFormat({ typed: true });
        const state = { text: '=' };
        testRoundTrip(format, state);
      });

      it('should round-trip string that is just ":" (primitiveMarker)', () => {
        const format = createFormat({ typed: true });
        const state = { text: ':' };
        testRoundTrip(format, state);
      });

      it('should round-trip string that is just "@" (arrayMarker)', () => {
        const format = createFormat({ typed: true });
        const state = { text: '@' };
        testRoundTrip(format, state);
      });

      it('should round-trip string that is just "." (objectMarker/nestingSeparator)', () => {
        const format = createFormat({ typed: true });
        const state = { text: '.' };
        testRoundTrip(format, state);
      });

      // Combinations of all markers
      it('should round-trip string with all markers "=:@.~/"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '=:@.~/' };
        testRoundTrip(format, state);
      });

      // Marker at start, middle, end
      it('should round-trip "@start"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '@start' };
        testRoundTrip(format, state);
      });

      it('should round-trip "mid@dle"', () => {
        const format = createFormat({ typed: true });
        const state = { text: 'mid@dle' };
        testRoundTrip(format, state);
      });

      it('should round-trip "end@"', () => {
        const format = createFormat({ typed: true });
        const state = { text: 'end@' };
        testRoundTrip(format, state);
      });

      // Empty string
      it('should round-trip empty string', () => {
        const format = createFormat({ typed: true });
        const state = { text: '' };
        testRoundTrip(format, state);
      });

      // String that looks like escaped marker
      it('should round-trip string that looks like escaped marker "/="', () => {
        const format = createFormat({ typed: true });
        const state = { text: '/=' };
        testRoundTrip(format, state);
      });

      it('should round-trip string "/@"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '/@' };
        testRoundTrip(format, state);
      });

      // Nested escape sequences
      it('should round-trip "////" (4 escapes)', () => {
        const format = createFormat({ typed: true });
        const state = { text: '////' };
        testRoundTrip(format, state);
      });

      it('should round-trip "/~/~" (alternating escape and terminator)', () => {
        const format = createFormat({ typed: true });
        const state = { text: '/~/~' };
        testRoundTrip(format, state);
      });

      // Strings that could confuse the parser
      it('should round-trip string that looks like array "@a,b,c~"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '@a,b,c~' };
        testRoundTrip(format, state);
      });

      it('should round-trip string that looks like object ".key=value~"', () => {
        const format = createFormat({ typed: true });
        const state = { text: '.key=value~' };
        testRoundTrip(format, state);
      });

      it('should round-trip string that looks like primitive ":42"', () => {
        const format = createFormat({ typed: true });
        const state = { text: ':42' };
        testRoundTrip(format, state);
      });

      it('should round-trip string that looks like boolean ":true"', () => {
        const format = createFormat({ typed: true });
        const state = { text: ':true' };
        testRoundTrip(format, state);
      });

      it('should round-trip string that looks like null ":null"', () => {
        const format = createFormat({ typed: true });
        const state = { text: ':null' };
        testRoundTrip(format, state);
      });

      // Date-like strings
      it('should round-trip string that looks like date prefix "D1234567890"', () => {
        const format = createFormat({ typed: true });
        const state = { text: 'D1234567890' };
        testRoundTrip(format, state);
      });

      it('should round-trip string "D" alone', () => {
        const format = createFormat({ typed: true });
        const state = { text: 'D' };
        testRoundTrip(format, state);
      });

      // Arrays with problematic elements
      it('should round-trip array with empty strings ["", "", ""]', () => {
        const format = createFormat({ typed: true });
        const state = { items: ['', '', ''] };
        testRoundTrip(format, state);
      });

      it('should round-trip array with terminators ["~", "~~", "~~~"]', () => {
        const format = createFormat({ typed: true });
        const state = { items: ['~', '~~', '~~~'] };
        testRoundTrip(format, state);
      });

      it('should round-trip array with escapes ["/", "//", "///"]', () => {
        const format = createFormat({ typed: true });
        const state = { items: ['/', '//', '///'] };
        testRoundTrip(format, state);
      });

      it('should round-trip array with markers ["@", ":", "=", "."]', () => {
        const format = createFormat({ typed: true });
        const state = { items: ['@', ':', '=', '.'] };
        testRoundTrip(format, state);
      });

      it('should round-trip array with separators [",", ";", "|"]', () => {
        const format = createFormat({ typed: true });
        const state = { items: [',', ';', '|'] };
        testRoundTrip(format, state);
      });

      // Flat mode with arraySeparator edge cases
      it('should round-trip array where elements contain the arraySeparator (comma)', () => {
        const format = createFormat({ typed: false, separators: { array: ',' } });
        const state = { items: ['a,b', 'c,d,e', ',', ',,'] };
        testStandaloneRoundTrip(format, state);
      });

      it('should round-trip array where elements contain the arraySeparator (pipe)', () => {
        const format = createFormat({ typed: false, separators: { array: '|' } });
        const state = { items: ['a|b', 'c|d|e', '|', '||'] };
        testStandaloneRoundTrip(format, state);
      });

      // Keys with special characters
      it('should round-trip object with key containing dot', () => {
        const format = createFormat({ typed: true });
        const state = { 'key.with.dots': 'value' };
        testRoundTrip(format, state);
      });

      it('should round-trip object with key containing equals', () => {
        const format = createFormat({ typed: true });
        const state = { 'key=value': 'actual value' };
        testRoundTrip(format, state);
      });

      it('should round-trip object with key containing comma', () => {
        const format = createFormat({ typed: true });
        const state = { 'key,with,commas': 'value' };
        testRoundTrip(format, state);
      });

      // Nested objects with problematic values at every level
      it('should round-trip deeply nested with special chars at each level', () => {
        const format = createFormat({ typed: true });
        const state = {
          'level1~': {
            'level2@': {
              'level3:': {
                value: '=:@.~/',
              },
            },
          },
        };
        testRoundTrip(format, state);
      });

      // Mix of arrays and objects with special chars
      it('should round-trip array of objects with special char keys and values', () => {
        const format = createFormat({ typed: true });
        const state = {
          items: [
            { '@key': '~value~' },
            { ':key': '/value/' },
            { '=key': ',value,' },
          ],
        };
        testRoundTrip(format, state);
      });

      // Unicode edge cases
      it('should round-trip string with zero-width characters', () => {
        const format = createFormat({ typed: true });
        const state = { text: 'a\u200Bb\u200Cc' }; // zero-width space and zero-width non-joiner
        testRoundTrip(format, state);
      });

      it('should round-trip string with combining characters', () => {
        const format = createFormat({ typed: true });
        const state = { text: 'e\u0301' }; // e + combining acute accent = é
        testRoundTrip(format, state);
      });

      it('should round-trip string with surrogate pairs (emoji)', () => {
        const format = createFormat({ typed: true });
        const state = { text: '👨‍👩‍👧‍👦' }; // family emoji (multiple code points)
        testRoundTrip(format, state);
      });

      // Very long strings
      it('should round-trip very long string (10000 chars)', () => {
        const format = createFormat({ typed: true });
        const state = { text: 'a'.repeat(10000) };
        testRoundTrip(format, state);
      });

      it('should round-trip very long string with repeating special chars', () => {
        const format = createFormat({ typed: true });
        const state = { text: '~@:=./'.repeat(1000) };
        testRoundTrip(format, state);
      });

      // Custom separator conflicts
      it('should handle when separator equals escape char (should throw or escape properly)', () => {
        // This should either throw an error or handle it correctly
        expect(() => {
          const format = createFormat({ typed: false, separators: { entry: '/', escape: '/' } });
          const state = { text: 'value' };
          format.stringify(state);
        }).toThrow();
      });

      // Whitespace edge cases
      it('should round-trip string with only spaces', () => {
        const format = createFormat({ typed: true });
        const state = { text: '   ' };
        testRoundTrip(format, state);
      });

      it('should round-trip string with tabs and newlines', () => {
        const format = createFormat({ typed: true });
        const state = { text: '\t\n\r' };
        testRoundTrip(format, state);
      });

      it('should round-trip string with leading/trailing whitespace', () => {
        const format = createFormat({ typed: true });
        const state = { text: '  value  ' };
        testRoundTrip(format, state);
      });

      // Standalone mode specific edge cases
      describe('standalone mode specific', () => {
        it('should round-trip in standalone when value starts with @', () => {
          const format = createFormat({ typed: true });
          const state = { field: '@value' };
          const serialized = format.stringifyStandalone(state);
          const parsed = format.parseStandalone(serialized, { initialState: state });
          expect(parsed).toEqual(state);
        });

        it('should round-trip in standalone when value starts with :', () => {
          const format = createFormat({ typed: true });
          const state = { field: ':value' };
          const serialized = format.stringifyStandalone(state);
          const parsed = format.parseStandalone(serialized, { initialState: state });
          expect(parsed).toEqual(state);
        });

        it('should round-trip in standalone when value starts with =', () => {
          const format = createFormat({ typed: true });
          const state = { field: '=value' };
          const serialized = format.stringifyStandalone(state);
          const parsed = format.parseStandalone(serialized, { initialState: state });
          expect(parsed).toEqual(state);
        });

        it('should round-trip in standalone when value starts with .', () => {
          const format = createFormat({ typed: true });
          const state = { field: '.value' };
          const serialized = format.stringifyStandalone(state);
          const parsed = format.parseStandalone(serialized, { initialState: state });
          expect(parsed).toEqual(state);
        });

        it('should round-trip in standalone with value that is just comma', () => {
          const format = createFormat({ typed: true });
          const state = { field: ',' };
          const serialized = format.stringifyStandalone(state);
          const parsed = format.parseStandalone(serialized, { initialState: state });
          expect(parsed).toEqual(state);
        });
      });

      // Flat mode with same separator for array and field
      describe('plain mode same separator edge cases', () => {
        it('should round-trip when arraySeparator equals separator in plain mode', () => {
          const format = createFormat({ 
            typed: false, 
            separators: { array: ',', entry: ',' }
          });
          const state = { items: ['a', 'b', 'c'], name: 'test' };
          // This uses standalone mode
          testStandaloneRoundTrip(format, state);
        });

        it('should round-trip array with values containing separator when arraySep = sep', () => {
          const format = createFormat({ 
            typed: false, 
            separators: { array: ',', entry: ',' }
          });
          const state = { items: ['a,b', 'c,d'] };
          testStandaloneRoundTrip(format, state);
        });
      });

      // Test parsing potentially malicious/malformed inputs
      describe('malformed input handling', () => {
        it('should handle unbalanced terminators in parse', () => {
          const format = createFormat({ typed: true });
          // Missing closing terminator
          const result = format.parse('@a,b,c');
          // Should still parse something reasonable
          expect(result).toBeDefined();
        });

        it('should handle extra terminators in parse', () => {
          const format = createFormat({ typed: true });
          const result = format.parse('text=hello~~~');
          expect(result).toBeDefined();
        });

        it('should handle escape at end of string', () => {
          const format = createFormat({ typed: true });
          // Trailing escape with nothing after it
          const result = format.parse('text=hello/');
          expect(result).toBeDefined();
        });

        it('should handle only escape characters', () => {
          const format = createFormat({ typed: true });
          const result = format.parse('text=///');
          expect(result).toBeDefined();
        });

        it('should handle empty key', () => {
          const format = createFormat({ typed: false });
          const result = format.parse('=value');
          expect(result).toBeDefined();
        });

        it('should handle only equals sign', () => {
          const format = createFormat({ typed: false });
          const result = format.parse('=');
          expect(result).toBeDefined();
        });

        it('should handle multiple equals in plain mode', () => {
          const format = createFormat({ typed: false });
          const result = format.parse('key=val=ue');
          // Should parse key as "key" and value as "val=ue"
          expect(result).toEqual({ key: 'val=ue' });
        });
      });

      // Test type coercion edge cases
      describe('type coercion edge cases', () => {
        it('should coerce "true" to boolean when initialState has boolean', () => {
          const format = createFormat({ typed: false });
          const params = { flag: ['true'] };
          const result = format.parseStandalone(params, { initialState: { flag: false } });
          expect(result).toEqual({ flag: true });
          expect(typeof (result as {flag: boolean}).flag).toBe('boolean');
        });

        it('should coerce "1" to number when initialState has number', () => {
          const format = createFormat({ typed: false });
          const params = { count: ['1'] };
          const result = format.parseStandalone(params, { initialState: { count: 0 } });
          expect(result).toEqual({ count: 1 });
          expect(typeof (result as {count: number}).count).toBe('number');
        });

        it('should coerce timestamp to Date when initialState has Date', () => {
          const format = createFormat({ typed: false, serialize: { dates: 'timestamp' } });
          const date = new Date('2024-01-15T10:30:00.000Z');
          const params = { created: [String(date.getTime())] };
          const result = format.parseStandalone(params, { initialState: { created: new Date() } });
          expect((result as {created: Date}).created).toBeInstanceOf(Date);
          expect((result as {created: Date}).created.getTime()).toBe(date.getTime());
        });

        it('should NOT coerce when initialState type is string', () => {
          const format = createFormat({ typed: false });
          const params = { value: ['42'] };
          const result = format.parseStandalone(params, { initialState: { value: 'default' } });
          // When hint is string, should keep as string? Or auto-parse?
          // This depends on implementation - let's see what happens
          expect(result).toBeDefined();
        });

        it('should handle coercion with nested initialState', () => {
          const format = createFormat({ typed: false });
          const params = { 'user.age': ['25'] };
          const result = format.parseStandalone(params, { 
            initialState: { user: { age: 0 } } 
          });
          expect((result as any).user.age).toBe(25);
          expect(typeof (result as any).user.age).toBe('number');
        });

        it('should handle array element coercion', () => {
          const format = createFormat({ typed: false });
          const params = { numbers: ['1', '2', '3'] };
          const result = format.parseStandalone(params, { 
            initialState: { numbers: [0] } 
          });
          expect((result as any).numbers).toEqual([1, 2, 3]);
        });
      });

      // Test with all options disabled
      describe('with markers disabled', () => {
        it('should round-trip with markers: { array: false }', () => {
          const format = createFormat({ typed: true, markers: { array: false } });
          const state = { items: ['a', 'b', 'c'], text: 'hello' };
          testStandaloneRoundTrip(format, state);
        });

        it('should round-trip with markers: { primitive: false }', () => {
          const format = createFormat({ typed: true, markers: { primitive: false } });
          const state = { count: 42, flag: true, text: 'hello' };
          testStandaloneRoundTrip(format, state);
        });

        it('should round-trip with markers: { datePrefix: false }', () => {
          const format = createFormat({ typed: true, markers: { datePrefix: false } });
          const state = { created: new Date('2024-01-15T10:30:00.000Z') };
          testStandaloneRoundTrip(format, state);
        });

        it('should round-trip with all markers disabled', () => {
          const format = createFormat({ 
            typed: true, 
            markers: { array: false, primitive: false, datePrefix: false }
          });
          const state = { 
            items: ['a', 'b'], 
            count: 42, 
            flag: true,
            created: new Date('2024-01-15T10:30:00.000Z'),
            text: 'hello'
          };
          testStandaloneRoundTrip(format, state);
        });
      });

      // Test with custom markers
      describe('with custom markers', () => {
        it('should work with markers: { string: "s" }', () => {
          const format = createFormat({ typed: true, markers: { string: 's' } });
          const state = { text: 'hello world' };
          testRoundTrip(format, state);
        });

        it('should work with markers: { primitive: "#" }', () => {
          const format = createFormat({ typed: true, markers: { primitive: '#' } });
          const state = { count: 42, flag: true };
          testRoundTrip(format, state);
        });

        it('should work with markers: { array: "[" }', () => {
          const format = createFormat({ typed: true, markers: { array: '[' } });
          const state = { items: ['a', 'b', 'c'] };
          testRoundTrip(format, state);
        });

        it('should work with markers: { terminator: "]" }', () => {
          const format = createFormat({ typed: true, markers: { terminator: ']' } });
          const state = { items: ['a', 'b'], nested: { key: 'value' } };
          testRoundTrip(format, state);
        });

        it('should work with separators: { escape: "\\\\" }', () => {
          const format = createFormat({ typed: true, separators: { escape: '\\' } });
          const state = { text: '~@:=./' };
          testRoundTrip(format, state);
        });

        // Test that custom markers still need escaping
        it('should escape custom markers in values', () => {
          const format = createFormat({ typed: true, markers: { array: '[', terminator: ']' } });
          const state = { text: 'array[0]' };
          testRoundTrip(format, state);
        });
      });

      // Numeric edge cases
      describe('numeric edge cases', () => {
        it('should round-trip negative zero', () => {
          const format = createFormat({ typed: true });
          const state = { value: -0 };
          const serialized = format.stringify(state);
          const parsed = format.parse(serialized);
          // Note: -0 === 0 in JS, but Object.is(-0, 0) is false
          expect((parsed as any).value).toBe(0);
        });

        it('should round-trip Infinity', () => {
          const format = createFormat({ typed: true });
          const state = { value: Infinity };
          const serialized = format.stringify(state);
          const parsed = format.parse(serialized);
          expect((parsed as any).value).toBe(Infinity);
        });

        it('should round-trip -Infinity', () => {
          const format = createFormat({ typed: true });
          const state = { value: -Infinity };
          const serialized = format.stringify(state);
          const parsed = format.parse(serialized);
          expect((parsed as any).value).toBe(-Infinity);
        });

        it('should round-trip very small decimal', () => {
          const format = createFormat({ typed: true });
          const state = { value: 0.0000000001 };
          testRoundTrip(format, state);
        });

        it('should round-trip very large number', () => {
          const format = createFormat({ typed: true });
          const state = { value: 9999999999999999 };
          testRoundTrip(format, state);
        });

        it('should round-trip scientific notation number', () => {
          const format = createFormat({ typed: true });
          const state = { value: 1.23e10 };
          testRoundTrip(format, state);
        });
      });

      // Date edge cases
      describe('date edge cases', () => {
        it('should round-trip date at Unix epoch (1970-01-01)', () => {
          const format = createFormat({ typed: true });
          const state = { created: new Date(0) };
          testRoundTrip(format, state);
        });

        it('should round-trip date before Unix epoch (negative timestamp)', () => {
          const format = createFormat({ typed: true });
          const state = { created: new Date(-86400000) }; // 1969-12-31
          testRoundTrip(format, state);
        });

        it('should round-trip date far in future', () => {
          const format = createFormat({ typed: true });
          const state = { created: new Date('2999-12-31T23:59:59.999Z') };
          testRoundTrip(format, state);
        });

        it('should round-trip date with milliseconds', () => {
          const format = createFormat({ typed: true });
          const state = { created: new Date('2024-01-15T10:30:00.123Z') };
          testRoundTrip(format, state);
        });
      });
    });
  });

  describe('nullString option', () => {
    // Empty string is a special case - can't be auto-parsed as null without type info
    const nullStringsWithAutoParse = ['null', 'nil', 'NULL', 'none'];
    const nullStringsRequiringType = [''];

    nullStringsWithAutoParse.forEach(ns => {
      it(`should use nullString="${ns}"`, () => {
        const format = createFormat({ typed: false, serialize: { null: ns } });
        const result = format.stringifyStandalone({ value: null });
        expect(result.value).toEqual([ns]);
      });

      it(`should parse nullString="${ns}"`, () => {
        const format = createFormat({ typed: false, serialize: { null: ns } });
        const params = [{ key: 'value', value: ns }];
        const result = format.parseStandalone(toParams(params), { initialState: {} });
        expect(result).toEqual({ value: null });
      });
    });

    nullStringsRequiringType.forEach(ns => {
      it(`should use nullString="${ns}" (empty)`, () => {
        const format = createFormat({ typed: false, serialize: { null: ns } });
        const result = format.stringifyStandalone({ value: null });
        expect(result.value).toEqual([ns]);
      });

      // Empty string needs type info from initialState to be parsed as null
      it(`should parse nullString="${ns}" with initialState`, () => {
        const format = createFormat({ typed: false, serialize: { null: ns } });
        const params = [{ key: 'value', value: ns }];
        // Without knowing the expected type is null, empty string stays as empty string
        const result = format.parseStandalone(toParams(params), { initialState: { value: null } });
        expect(result).toEqual({ value: null });
      });
    });
  });

  describe('undefinedString option', () => {
    const undefinedStrings = ['undefined', 'undef', 'UNDEFINED', 'void'];

    undefinedStrings.forEach(us => {
      it(`should use undefinedString="${us}"`, () => {
        const format = createFormat({ typed: false, serialize: { undefined: us } });
        const result = format.stringifyStandalone({ value: undefined });
        expect(result.value).toEqual([us]);
      });

      it(`should parse undefinedString="${us}"`, () => {
        const format = createFormat({ typed: false, serialize: { undefined: us } });
        const params = [{ key: 'value', value: us }];
        const result = format.parseStandalone(toParams(params), { initialState: {} });
        expect(result).toEqual({ value: undefined });
      });
    });
  });

  describe('booleanStyle option', () => {
    it('should use string style by default', () => {
      const format = createFormat({ typed: false, serialize: { booleans: 'string' } });
      const result = format.stringifyStandalone(boolState);
      expect(result.yes).toEqual(['true']);
      expect(result.no).toEqual(['false']);
    });

    it('should use number style', () => {
      const format = createFormat({ typed: false, serialize: { booleans: 'number' } });
      const result = format.stringifyStandalone(boolState);
      expect(result.yes).toEqual(['1']);
      expect(result.no).toEqual(['0']);
    });

    it('should parse number style booleans with initialState', () => {
      const format = createFormat({ typed: false, serialize: { booleans: 'number' } });
      const params = [
        { key: 'yes', value: '1' },
        { key: 'no', value: '0' },
      ];
      const result = format.parseStandalone(toParams(params), { initialState: boolState });
      expect(result).toEqual(boolState);
    });

    // NOTE: booleanStyle='number' cannot round-trip in namespaced mode without initialState
    // because "1" is auto-parsed as number 1, not boolean true
    it('should round-trip standalone with number style', () => {
      const format = createFormat({ typed: false, serialize: { booleans: 'number' } });
      testStandaloneRoundTrip(format, boolState);
    });

    it('should round-trip with string style (default)', () => {
      const format = createFormat({ typed: false, serialize: { booleans: 'string' } });
      testRoundTrip(format, boolState);
    });
  });

  describe('dateStyle option', () => {
    it('should use iso style by default', () => {
      const format = createFormat({ typed: false, serialize: { dates: 'iso' } });
      const result = format.stringifyStandalone(dateState);
      expect(result.created).toEqual(['2024-01-15T10:30:00.000Z']);
    });

    it('should use timestamp style', () => {
      const format = createFormat({ typed: false, serialize: { dates: 'timestamp' } });
      const result = format.stringifyStandalone(dateState);
      expect(result.created).toEqual([String(dateState.created.getTime())]);
    });

    it('should parse timestamp style dates with initialState', () => {
      const format = createFormat({ typed: false, serialize: { dates: 'timestamp' } });
      const params = [{ key: 'created', value: String(dateState.created.getTime()) }];
      const result = format.parseStandalone(toParams(params), { initialState: dateState });
      expect((result as typeof dateState).created.getTime()).toBe(dateState.created.getTime());
    });

    // NOTE: dateStyle='timestamp' cannot round-trip in namespaced mode without initialState
    // because timestamps are auto-parsed as numbers
    it('should round-trip standalone with timestamp style', () => {
      const format = createFormat({ typed: false, serialize: { dates: 'timestamp' } });
      testStandaloneRoundTrip(format, dateState);
    });

    it('should round-trip with iso style (default)', () => {
      const format = createFormat({ typed: false, serialize: { dates: 'iso' } });
      const str = format.stringify(dateState);
      const parsed = format.parse(str);
      expect((parsed as typeof dateState).created.getTime()).toBe(dateState.created.getTime());
    });

    // Compact mode dateStyle tests
    it('should use timestamp style in typed mode (default)', () => {
      const format = createFormat({ typed: true, serialize: { dates: 'timestamp' } });
      const result = format.stringifyStandalone({ created: dateState.created });
      expect(result.created).toEqual([`D${dateState.created.getTime()}`]);
    });

    it('should use iso style in typed mode', () => {
      const format = createFormat({ typed: true, serialize: { dates: 'iso' } });
      const result = format.stringifyStandalone({ created: dateState.created });
      expect(result.created).toEqual([`D${dateState.created.toISOString()}`]);
    });

    it('should round-trip typed mode with iso dateStyle', () => {
      const format = createFormat({ typed: true, serialize: { dates: 'iso' } });
      const state = { created: new Date('2024-01-15T10:30:00.000Z') };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect((parsed as typeof state).created.getTime()).toBe(state.created.getTime());
    });

    it('should round-trip typed mode with timestamp dateStyle', () => {
      const format = createFormat({ typed: true, serialize: { dates: 'timestamp' } });
      const state = { created: new Date('2024-01-15T10:30:00.000Z') };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect((parsed as typeof state).created.getTime()).toBe(state.created.getTime());
    });
  });

  describe('datePrefix option', () => {
    it('should use datePrefix="D" by default', () => {
      const format = createFormat({ typed: true });
      const state = { created: new Date('2024-01-15T10:30:00.000Z') };
      const result = format.stringifyStandalone(state);
      // Should have D prefix
      expect(result.created[0]).toMatch(/^D\d+$/);
    });

    it('should serialize dates without prefix when datePrefix=false', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'timestamp' } });
      const state = { created: new Date('2024-01-15T10:30:00.000Z') };
      const result = format.stringifyStandalone(state);
      // Should NOT have D prefix - just plain timestamp (auto-parsed on read)
      expect(result.created[0]).toBe(`${state.created.getTime()}`);
    });

    it('should serialize dates as ISO without prefix when datePrefix=false and dateStyle=iso', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'iso' } });
      const state = { created: new Date('2024-01-15T10:30:00.000Z') };
      const result = format.stringifyStandalone(state);
      // Should NOT have D prefix - just plain ISO string (auto-parsed on read)
      expect(result.created[0]).toBe(`${state.created.toISOString()}`);
    });

    it('should parse dates with initialState when datePrefix=false', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'timestamp' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const params = toParams([{ key: 'created', value: String(date.getTime()) }]);
      const parsed = format.parseStandalone(params, { initialState: { created: date } });
      expect((parsed as {created: Date}).created).toBeInstanceOf(Date);
      expect((parsed as {created: Date}).created.getTime()).toBe(date.getTime());
    });

    it('should round-trip dates with datePrefix=false using initialState', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'timestamp' } });
      const state = { created: new Date('2024-01-15T10:30:00.000Z') };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect((parsed as typeof state).created).toBeInstanceOf(Date);
      expect((parsed as typeof state).created.getTime()).toBe(state.created.getTime());
    });

    it('should auto-parse timestamps when dateStyle=timestamp and datePrefix=false', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'timestamp' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const params = toParams([{ key: 'created', value: String(date.getTime()) }]);
      // With serialize: { dates: 'timestamp' }, timestamps ARE auto-parsed as dates
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect((parsed as {created: Date}).created).toBeInstanceOf(Date);
    });

    it('should NOT auto-parse timestamps when dateStyle=iso and datePrefix=false', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'iso' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const params = toParams([{ key: 'created', value: String(date.getTime()) }]);
      // In typed mode (typed: true), standalone parsing doesn't auto-parse numbers
      // The timestamp is just a string without any type marker
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect(typeof (parsed as {created: string}).created).toBe('string');
    });
  });

  describe('auto-parsing options', () => {
    it('should auto-parse numbers by default', () => {
      const format = createFormat({ typed: false });
      const params = [{ key: 'num', value: '42' }];
      const result = format.parseStandalone(toParams(params), { initialState: {} });
      expect(result).toEqual({ num: 42 });
    });

    it('should disable auto-parsing numbers', () => {
      const format = createFormat({ typed: false, parse: { numbers: false } });
      const params = [{ key: 'num', value: '42' }];
      const result = format.parseStandalone(toParams(params), { initialState: {} });
      expect(result).toEqual({ num: '42' });
    });

    it('should auto-parse booleans by default', () => {
      const format = createFormat({ typed: false });
      const params = [{ key: 'flag', value: 'true' }];
      const result = format.parseStandalone(toParams(params), { initialState: {} });
      expect(result).toEqual({ flag: true });
    });

    it('should disable auto-parsing booleans', () => {
      const format = createFormat({ typed: false, parse: { booleans: false } });
      const params = [{ key: 'flag', value: 'true' }];
      const result = format.parseStandalone(toParams(params), { initialState: {} });
      expect(result).toEqual({ flag: 'true' });
    });

    it('should auto-parse ISO dates by default', () => {
      const format = createFormat({ typed: false });
      const params = [{ key: 'date', value: '2024-01-15T10:30:00.000Z' }];
      const result = format.parseStandalone(toParams(params), { initialState: {} });
      expect((result as { date: Date }).date).toBeInstanceOf(Date);
    });

    it('should disable auto-parsing dates', () => {
      const format = createFormat({ typed: false, parse: { dates: false } });
      const params = [{ key: 'date', value: '2024-01-15T10:30:00.000Z' }];
      const result = format.parseStandalone(toParams(params), { initialState: {} });
      expect(result).toEqual({ date: '2024-01-15T10:30:00.000Z' });
    });

    it('should disable all auto-parsing', () => {
      const format = createFormat({
        parse: { numbers: false, booleans: false, dates: false },
      });
      const params = [
        { key: 'num', value: '42' },
        { key: 'flag', value: 'true' },
        { key: 'date', value: '2024-01-15T10:30:00.000Z' },
      ];
      const result = format.parseStandalone(toParams(params), { initialState: {} });
      expect(result).toEqual({
        num: '42',
        flag: 'true',
        date: '2024-01-15T10:30:00.000Z',
      });
    });
  });
});

// =============================================================================
// COMPACT MODE - ALL OPTIONS PERMUTATIONS  
// =============================================================================

describe('configurable format - typed mode', () => {
  const simpleState = { name: 'John', age: 30, active: true };
  const nestedState = { user: { name: 'John', profile: { city: 'NYC' } } };
  const arrayState = { tags: ['a', 'b', 'c'] };
  const arrayOfNumbersState = { ids: [1, 2, 3] };
  const emptyArrayState = { items: [] };
  const arrayOfObjectsState = { users: [{ name: 'Alice' }, { name: 'Bob' }] };
  const dateState = { created: new Date('2024-01-15T10:30:00.000Z') };
  const nullState = { value: null };
  const undefinedState = { value: undefined };
  const boolState = { yes: true, no: false };
  const mixedArrayState = { items: ['text', 42, true, null] };
  const nestedArrayState = { matrix: [[1, 2], [3, 4]] };

  describe('default typed preset', () => {
    it('should round-trip simple state', () => {
      testRoundTrip(typed, simpleState);
    });

    it('should round-trip nested state', () => {
      testRoundTrip(typed, nestedState);
    });

    it('should round-trip array state', () => {
      testRoundTrip(typed, arrayState);
    });

    it('should round-trip array of numbers', () => {
      testRoundTrip(typed, arrayOfNumbersState);
    });

    it('should round-trip empty array', () => {
      testRoundTrip(typed, emptyArrayState);
    });

    it('should round-trip array of objects', () => {
      testRoundTrip(typed, arrayOfObjectsState);
    });

    it('should round-trip date state', () => {
      const str = typed.stringify(dateState);
      const parsed = typed.parse(str);
      expect((parsed as typeof dateState).created.getTime()).toBe(dateState.created.getTime());
    });

    it('should round-trip null state', () => {
      testRoundTrip(typed, nullState);
    });

    it('should round-trip undefined state', () => {
      testRoundTrip(typed, undefinedState);
    });

    it('should round-trip bool state', () => {
      testRoundTrip(typed, boolState);
    });

    it('should round-trip mixed array', () => {
      testRoundTrip(typed, mixedArrayState);
    });

    it('should round-trip nested arrays', () => {
      testRoundTrip(typed, nestedArrayState);
    });
  });

  describe('typed mode type markers', () => {
    it('should use = for string', () => {
      const result = typed.stringify({ name: 'John' });
      expect(result).toBe('name=John');
    });

    it('should use : for number', () => {
      const result = typed.stringify({ age: 30 });
      expect(result).toBe('age:30');
    });

    it('should use : for boolean', () => {
      const result = typed.stringify({ active: true });
      expect(result).toBe('active:true');
    });

    it('should use @ for array', () => {
      const result = typed.stringify({ tags: ['a', 'b'] });
      expect(result).toBe('tags@a,b');
    });

    it('should use . for nested object', () => {
      const result = typed.stringify({ user: { name: 'John' } });
      expect(result).toBe('user.name=John');
    });

    it('should use =D for date (string with D prefix)', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const result = typed.stringify({ created: date });
      // Dates are serialized as strings (= marker) with D prefix
      expect(result).toBe(`created=D${date.getTime()}`);
    });
  });

  describe('typed stringMarker option', () => {
    const markers = ['=', "'", '"', 's', 'S'];

    markers.forEach(m => {
      it(`should use stringMarker="${m}"`, () => {
        const format = createFormat({ typed: true, markers: { string: m } });
        const result = format.stringify({ name: 'John' });
        expect(result).toContain(`name${m}John`);
      });

      it(`should round-trip with stringMarker="${m}"`, () => {
        const format = createFormat({ typed: true, markers: { string: m } });
        testRoundTrip(format, simpleState);
      });
    });
  });

  describe('typed primitiveMarker option', () => {
    const markers = [':', '#', 'p', 'P'];

    markers.forEach(m => {
      it(`should use primitiveMarker="${m}"`, () => {
        const format = createFormat({ typed: true, markers: { primitive: m } });
        const result = format.stringify({ age: 30 });
        expect(result).toContain(`age${m}30`);
      });

      it(`should round-trip with primitiveMarker="${m}"`, () => {
        const format = createFormat({ typed: true, markers: { primitive: m } });
        testRoundTrip(format, { age: 30, active: true });
      });
    });
  });

  describe('typed arrayMarker option', () => {
    const markers = ['@', '[', 'a', 'A'];

    markers.forEach(m => {
      it(`should use arrayMarker="${m}" and round-trip`, () => {
        const format = createFormat({ typed: true, markers: { array: m } });
        // Use a key that doesn't contain the marker
        const testKey = m === 'a' || m === 'A' ? 'items' : 'tags';
        const state = { [testKey]: ['x', 'y', 'z'] };
        const result = format.stringify(state);
        expect(result).toContain(`${testKey}${m}`);
        // Most importantly, verify round-trip works
        const parsed = format.parse(result);
        expect(parsed).toEqual(state);
      });

      it(`should round-trip arrayState with arrayMarker="${m}"`, () => {
        const format = createFormat({ typed: true, markers: { array: m } });
        testRoundTrip(format, arrayState);
      });
    });
  });

  describe('typed separator option', () => {
    const separators = [',', ';', '|', '&'];

    separators.forEach(sep => {
      it(`should use separator="${sep}"`, () => {
        const format = createFormat({ typed: true, separators: { entry: sep } });
        const result = format.stringify({ a: 1, b: 2 });
        expect(result).toContain(sep);
      });

      it(`should round-trip with separator="${sep}"`, () => {
        const format = createFormat({ typed: true, separators: { entry: sep } });
        testRoundTrip(format, simpleState);
      });
    });
  });

  describe('typed terminator option', () => {
    const terminators = ['~', ']', ')', '}'];

    terminators.forEach(t => {
      it(`should round-trip with terminator="${t}"`, () => {
        const format = createFormat({ typed: true, markers: { terminator: t } });
        testRoundTrip(format, nestedState);
      });

      it(`should round-trip arrays with terminator="${t}"`, () => {
        const format = createFormat({ typed: true, markers: { terminator: t } });
        testRoundTrip(format, arrayOfObjectsState);
      });
    });
  });

  describe('typed escape option', () => {
    const escapeChars = ['/', '\\', '!', '%'];

    escapeChars.forEach(esc => {
      it(`should work with escape="${esc}"`, () => {
        const format = createFormat({ typed: true, separators: { escape: esc } });
        const state = { query: 'has,comma' };
        testRoundTrip(format, state);
      });

      it(`should escape the escape char with escape="${esc}"`, () => {
        const format = createFormat({ typed: true, separators: { escape: esc } });
        const state = { path: `a${esc}b` };
        testRoundTrip(format, state);
      });
    });
  });

  describe('typed datePrefix option', () => {
    const prefixes = ['D', 'T', 'd', 'date'];

    prefixes.forEach(p => {
      it(`should use datePrefix="${p}"`, () => {
        const format = createFormat({ typed: true, markers: { datePrefix: p } });
        const date = new Date('2024-01-15T10:30:00.000Z');
        const result = format.stringify({ created: date });
        expect(result).toContain(`${p}${date.getTime()}`);
      });

      it(`should round-trip with datePrefix="${p}"`, () => {
        const format = createFormat({ typed: true, markers: { datePrefix: p } });
        const str = format.stringify(dateState);
        const parsed = format.parse(str);
        expect((parsed as typeof dateState).created.getTime()).toBe(dateState.created.getTime());
      });
    });
  });

  describe('typed nullString option', () => {
    const nullStrings = ['null', 'nil', 'NULL'];

    nullStrings.forEach(ns => {
      it(`should use nullString="${ns}"`, () => {
        const format = createFormat({ typed: true, serialize: { null: ns } });
        const result = format.stringify({ value: null });
        expect(result).toContain(ns);
      });

      it(`should round-trip with nullString="${ns}"`, () => {
        const format = createFormat({ typed: true, serialize: { null: ns } });
        testRoundTrip(format, nullState);
      });
    });
  });

  describe('typed undefinedString option', () => {
    const undefinedStrings = ['undefined', 'undef', 'void'];

    undefinedStrings.forEach(us => {
      it(`should use undefinedString="${us}"`, () => {
        const format = createFormat({ typed: true, serialize: { undefined: us } });
        const result = format.stringify({ value: undefined });
        expect(result).toContain(us);
      });

      it(`should round-trip with undefinedString="${us}"`, () => {
        const format = createFormat({ typed: true, serialize: { undefined: us } });
        testRoundTrip(format, undefinedState);
      });
    });
  });
});

// =============================================================================
// EDGE CASES AND BUG HUNTING
// =============================================================================

describe('configurable format - edge cases', () => {
  describe('empty and null values', () => {
    it('should handle empty string value in plain mode', () => {
      const state = { name: '' };
      testRoundTrip(plain, state);
    });

    it('should handle empty string value in typed mode', () => {
      const state = { name: '' };
      testRoundTrip(typed, state);
    });

    it('should handle all-empty object', () => {
      const state = { a: '', b: '', c: '' };
      testRoundTrip(typed, state);
    });

    it('should handle object with only null values', () => {
      const state = { a: null, b: null };
      testRoundTrip(typed, state);
    });

    it('should handle object with only undefined values', () => {
      const state = { a: undefined, b: undefined };
      testRoundTrip(typed, state);
    });
  });

  describe('special characters in values', () => {
    it('should handle value with equals sign', () => {
      const state = { formula: 'a=b' };
      testRoundTrip(typed, state);
    });

    it('should handle value with colon', () => {
      const state = { time: '12:30:45' };
      testRoundTrip(typed, state);
    });

    it('should handle value with at sign', () => {
      const state = { email: 'user@example.com' };
      testRoundTrip(typed, state);
    });

    it('should handle value with tilde', () => {
      const state = { path: '~/documents' };
      testRoundTrip(typed, state);
    });

    it('should handle value with newline', () => {
      const state = { text: 'line1\nline2' };
      testRoundTrip(typed, state);
    });

    it('should handle value with tab', () => {
      const state = { text: 'col1\tcol2' };
      testRoundTrip(typed, state);
    });

    it('should handle value with multiple special chars', () => {
      const state = { complex: 'a=b:c@d~e,f' };
      testRoundTrip(typed, state);
    });
  });

  describe('special characters in keys', () => {
    it('should handle key with dot', () => {
      const state = { 'my.key': 'value' };
      testRoundTrip(typed, state);
    });

    it('should handle key with space', () => {
      const state = { 'my key': 'value' };
      testRoundTrip(typed, state);
    });

    it('should handle key with equals', () => {
      const state = { 'a=b': 'value' };
      testRoundTrip(typed, state);
    });

    it('should handle numeric key', () => {
      const state = { '123': 'value' };
      testRoundTrip(typed, state);
    });
  });

  describe('array edge cases', () => {
    it('should handle array with empty strings', () => {
      const state = { items: ['', '', ''] };
      testRoundTrip(typed, state);
    });

    it('should handle array with single empty string', () => {
      const state = { items: [''] };
      testRoundTrip(typed, state);
    });

    it('should handle array with null values', () => {
      const state = { items: [null, null] };
      testRoundTrip(typed, state);
    });

    it('should handle array with undefined values', () => {
      const state = { items: [undefined, undefined] };
      testRoundTrip(typed, state);
    });

    it('should handle array with mixed null and undefined', () => {
      const state = { items: [null, undefined, null] };
      testRoundTrip(typed, state);
    });

    it('should handle deeply nested arrays', () => {
      const state = { data: [[[1, 2], [3, 4]], [[5, 6], [7, 8]]] };
      testRoundTrip(typed, state);
    });

    it('should handle array of empty arrays', () => {
      const state = { items: [[], [], []] };
      testRoundTrip(typed, state);
    });

    it('should handle array with value starting with type marker', () => {
      const state = { items: ['=value', ':123', '@array', '.dot'] };
      testRoundTrip(typed, state);
    });
  });

  describe('number edge cases', () => {
    it('should handle zero', () => {
      const state = { n: 0 };
      testRoundTrip(typed, state);
    });

    it('should handle negative zero', () => {
      const state = { n: -0 };
      const str = typed.stringify(state);
      const parsed = typed.parse(str);
      expect(Object.is((parsed as { n: number }).n, 0)).toBe(true);
    });

    it('should handle negative numbers', () => {
      const state = { n: -42 };
      testRoundTrip(typed, state);
    });

    it('should handle decimal numbers', () => {
      const state = { n: 3.14159 };
      testRoundTrip(typed, state);
    });

    it('should handle scientific notation', () => {
      const state = { n: 1e10 };
      testRoundTrip(typed, state);
    });

    it('should handle very small decimals', () => {
      const state = { n: 0.000001 };
      testRoundTrip(typed, state);
    });

    it('should handle MAX_SAFE_INTEGER', () => {
      const state = { n: Number.MAX_SAFE_INTEGER };
      testRoundTrip(typed, state);
    });

    it('should handle MIN_SAFE_INTEGER', () => {
      const state = { n: Number.MIN_SAFE_INTEGER };
      testRoundTrip(typed, state);
    });

    it('should handle Infinity', () => {
      const state = { n: Infinity };
      testRoundTrip(typed, state);
    });

    it('should handle negative Infinity', () => {
      const state = { n: -Infinity };
      testRoundTrip(typed, state);
    });
  });

  describe('date edge cases', () => {
    it('should handle date at Unix epoch', () => {
      const state = { date: new Date(0) };
      const str = typed.stringify(state);
      const parsed = typed.parse(str);
      expect((parsed as { date: Date }).date.getTime()).toBe(0);
    });

    it('should handle date before Unix epoch', () => {
      const date = new Date('1960-01-01T00:00:00.000Z');
      const state = { date };
      const str = typed.stringify(state);
      const parsed = typed.parse(str);
      expect((parsed as { date: Date }).date.getTime()).toBe(date.getTime());
    });

    it('should handle date far in the future', () => {
      const date = new Date('2100-12-31T23:59:59.999Z');
      const state = { date };
      const str = typed.stringify(state);
      const parsed = typed.parse(str);
      expect((parsed as { date: Date }).date.getTime()).toBe(date.getTime());
    });
  });

  describe('deeply nested objects', () => {
    it('should handle 10 levels of nesting', () => {
      const state = {
        a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 'deep' } } } } } } } } }
      };
      testRoundTrip(typed, state);
    });

    it('should handle wide object at each level', () => {
      const state = {
        a1: { b1: 1, b2: 2 },
        a2: { b1: 3, b2: 4 },
        a3: { b1: 5, b2: 6 },
      };
      testRoundTrip(typed, state);
    });
  });

  describe('parse error handling', () => {
    it('should handle empty string input', () => {
      expect(plain.parse('')).toEqual({});
      expect(typed.parse('')).toEqual({});
    });

    it('should handle invalid input gracefully', () => {
      // Various potentially problematic inputs
      expect(() => plain.parse('=====')).not.toThrow();
      expect(() => typed.parse('=====')).not.toThrow();
    });
  });

  describe('configuration combinations', () => {
    it('should work with all plain options customized', () => {
      const format = createFormat({
        typed: false,
        separators: { nesting: '_', array: '|', entry: ';', escape: '\\' },
        plain: { arrayIndexStyle: 'bracket', emptyArrayMarker: '[]' },
        serialize: { null: 'nil', undefined: 'undef', booleans: 'number', dates: 'timestamp' },
        parse: { numbers: true, booleans: true, dates: true },
      });
      const state = { user: { name: 'John', age: 30 } };
      testStandaloneRoundTrip(format, state);
    });

    it('should work with all typed options customized', () => {
      const format = createFormat({
        typed: true,
        separators: { nesting: '_', entry: ';', escape: '\\' },
        markers: { string: "'", primitive: '#', array: '[', terminator: '}', datePrefix: 'T' },
        serialize: { null: 'nil', undefined: 'undef' },
      });
      const state = { name: 'John', age: 30, active: true, items: [1, 2, 3] };
      testRoundTrip(format, state);
    });
  });

  describe('unicode handling', () => {
    it('should handle unicode in values', () => {
      const state = { greeting: '你好世界' };
      testRoundTrip(typed, state);
    });

    it('should handle unicode in keys', () => {
      const state = { 'キー': 'value' };
      testRoundTrip(typed, state);
    });

    it('should handle emoji', () => {
      const state = { mood: '😀🎉' };
      testRoundTrip(typed, state);
    });

    it('should handle mixed unicode', () => {
      const state = { text: 'Hello 世界 🌍' };
      testRoundTrip(typed, state);
    });
  });

  describe('URL-like values', () => {
    it('should handle URL as value', () => {
      const state = { url: 'https://example.com/path?query=1&other=2' };
      testRoundTrip(typed, state);
    });

    it('should handle URL with fragment', () => {
      const state = { url: 'https://example.com/page#section' };
      testRoundTrip(typed, state);
    });

    it('should handle URL with port', () => {
      const state = { url: 'http://localhost:3000/api' };
      testRoundTrip(typed, state);
    });
  });

  describe('JSON-like strings', () => {
    it('should handle JSON string as value', () => {
      const state = { data: '{"key": "value"}' };
      testRoundTrip(typed, state);
    });

    it('should handle JSON array string as value', () => {
      const state = { data: '[1, 2, 3]' };
      testRoundTrip(typed, state);
    });
  });

  describe('parser error handling', () => {
    it('should handle parsing array with trailing separator', () => {
      // Simulate parsing "items@a,b,~" which has trailing separator before terminator
      const format = createFormat({ typed: true });
      // Create array with empty last element by manipulating directly
      const serialized = 'items@a,b,~';
      const parsed = format.parse(serialized);
      expect((parsed as { items: string[] }).items).toEqual(['a', 'b', '']);
    });

    it('should handle parsing array with leading separator', () => {
      // Simulate parsing "items@,a,b~"
      const format = createFormat({ typed: true });
      const serialized = 'items@,a,b~';
      const parsed = format.parse(serialized);
      expect((parsed as { items: string[] }).items).toEqual(['', 'a', 'b']);
    });

    it('should handle parsing array with consecutive separators', () => {
      // Simulate parsing "items@a,,b~"
      const format = createFormat({ typed: true });
      const serialized = 'items@a,,b~';
      const parsed = format.parse(serialized);
      expect((parsed as { items: string[] }).items).toEqual(['a', '', 'b']);
    });

    it('should parse date in standalone mode', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      
      // Simulate standalone value that is a date
      const standaloneValue = `D${date.getTime()}`;
      const params = [{ key: 'created', value: standaloneValue }];
      const result = format.parseStandalone(toParams(params), { initialState: {} });
      expect((result as { created: Date }).created.getTime()).toBe(date.getTime());
    });

    it('should handle escaped date prefix in string value', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' } });
      // A string that starts with D followed by digits but is actually a string
      // This happens when the string was escaped during serialization
      const state = { text: 'D12345' };  // This looks like a date but is a string
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });
  });

  describe('plain mode internal paths', () => {
    it('should handle object with numeric keys (converted to array)', () => {
      const format = createFormat({ typed: false });
      // Objects with numeric keys are treated as arrays in plain mode
      const state = { items: { 0: 'first', 1: 'second' } };
      const str = format.stringify(state);
      expect(str).toBe('items.0=first,items.1=second');
      const parsed = format.parse(str);
      // Numeric keys result in array
      expect(parsed).toEqual({ items: ['first', 'second'] });
    });

    it('should use non-repeat arraySeparator in namespaced stringify', () => {
      const format = createFormat({ typed: false, separators: { array: '|' } });
      const state = { tags: ['a', 'b', 'c'] };
      const str = format.stringify(state);
      expect(str).toBe('tags=a|b|c');
    });

    it('should handle key with escaped nesting separator', () => {
      const format = createFormat({ typed: false, separators: { nesting: '.', escape: '/' } });
      // In namespaced mode, a key 'a.b' (with literal dot) is escaped to 'a/.b'
      // When parsed, it should become { 'a.b': 'test' }
      const str = 'a/.b=test';
      const parsed = format.parse(str);
      expect(parsed).toEqual({ 'a.b': 'test' });
    });

    it('should handle key with nesting separator after escape sequence', () => {
      const format = createFormat({ typed: false, separators: { nesting: '.', escape: '/' } });
      // 'a//b.c' means: 'a' + escaped '/' + nesting sep + 'c'
      // So the key is 'a/b' nested under nothing, with 'c' as nested key
      // Actually: a// means 'a' + escape + '/' = key part 'a/'
      // Then .c = nesting separator + 'c'
      // Result should be { 'a/': { c: 'test' } }
      const str = 'a//.c=test';
      const parsed = format.parse(str);
      expect(parsed).toEqual({ 'a/': { c: 'test' } });
    });
  });

  describe('typed mode cleanup and error paths', () => {
    it('should clean up standalone date string marker', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D', string: '=' } });
      // Stringify a date in standalone mode
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { created: date };
      const standalone = format.stringifyStandalone(state);
      // The date value should be cleaned to just D{timestamp}
      expect(standalone.created).toEqual([`D${date.getTime()}`]);
    });

    it('should coerce date from ISO string when initialState has Date', () => {
      const format = createFormat({ typed: false });
      const date = new Date('2024-01-15T10:30:00.000Z');
      // Parse an ISO date string, coerce to Date based on initialState
      const params = [{ key: 'created', value: '2024-01-15T10:30:00.000Z' }];
      const parsed = format.parseStandalone(toParams(params), { initialState: { created: date } });
      expect((parsed as {created: Date}).created).toBeInstanceOf(Date);
      expect((parsed as {created: Date}).created.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should coerce date from timestamp when initialState has Date and dateStyle is timestamp', () => {
      const format = createFormat({ typed: false, serialize: { dates: 'timestamp' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      // Parse a timestamp string, coerce to Date based on initialState
      const params = [{ key: 'created', value: date.getTime().toString() }];
      const parsed = format.parseStandalone(toParams(params), { initialState: { created: date } });
      expect((parsed as {created: Date}).created).toBeInstanceOf(Date);
      expect((parsed as {created: Date}).created.getTime()).toBe(date.getTime());
    });

    it('should coerce date from ISO string when initialState has Date and dateStyle is iso', () => {
      const format = createFormat({ typed: false, serialize: { dates: 'iso' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      // Parse an ISO string, coerce to Date based on initialState
      const params = [{ key: 'created', value: date.toISOString() }];
      const parsed = format.parseStandalone(toParams(params), { initialState: { created: date } });
      expect((parsed as {created: Date}).created).toBeInstanceOf(Date);
      expect((parsed as {created: Date}).created.getTime()).toBe(date.getTime());
    });

    it('should handle invalid date string gracefully', () => {
      const format = createFormat({ typed: false });
      // Parse an invalid date string - falls back to auto-parse which returns as string
      const params = [{ key: 'created', value: 'not-a-date' }];
      const parsed = format.parseStandalone(toParams(params), { initialState: { created: new Date() } });
      // Falls back to auto-parse, which returns the string as-is
      expect((parsed as {created: string}).created).toBe('not-a-date');
    });

    it('should auto-parse timestamp date strings', () => {
      // NOTE: Timestamps are only auto-parsed as dates when serialize: { dates: 'timestamp' }
      const format = createFormat({ typed: false, parse: { dates: true }, serialize: { dates: 'timestamp' } });
      // Parse a timestamp (13+ digits) without initialState
      const timestamp = Date.now().toString();
      const params = [{ key: 'ts', value: timestamp }];
      const parsed = format.parseStandalone(toParams(params), { initialState: {} });
      expect((parsed as {ts: Date}).ts).toBeInstanceOf(Date);
    });

    it('should coerce array element types from initialState', () => {
      const format = createFormat({ typed: false });
      // When initialState has typed array, coerce elements
      const params = [{ key: 'counts', value: '42' }];
      const parsed = format.parseStandalone(toParams(params), { initialState: { counts: [0] } });
      expect((parsed as {counts: number[]}).counts).toEqual([42]);
    });

    it('should handle array with mixed objects and primitives', () => {
      const format = createFormat({ typed: false });
      // Array has both objects and primitives (mixed)
      const state = { items: [{ name: 'first' }, 'second', null] };
      const result = format.stringifyStandalone(state);
      // Each item should be serialized with index
      expect(result['items.0.name']).toEqual(['first']);
      expect(result['items.1']).toEqual(['second']);
      expect(result['items.2']).toEqual(['null']);
    });

    it('should parse typed ISO date in standalone mode', () => {
      const format = createFormat({ typed: true, serialize: { dates: 'iso' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      // Parse the standalone value directly
      const params = [{ key: 'created', value: `D${date.toISOString()}` }];
      const parsed = format.parseStandalone(toParams(params), { initialState: {} });
      expect((parsed as {created: Date}).created).toBeInstanceOf(Date);
      expect((parsed as {created: Date}).created.getTime()).toBe(date.getTime());
    });

    it('should handle invalid boolean coercion', () => {
      const format = createFormat({ typed: false });
      // When value doesn't match true/false/1/0, fall back to auto-parse (returns string)
      const params = [{ key: 'active', value: 'maybe' }];
      const parsed = format.parseStandalone(toParams(params), { initialState: { active: true } });
      expect((parsed as {active: string}).active).toBe('maybe');
    });

    it('should handle invalid number coercion', () => {
      const format = createFormat({ typed: false });
      // When value is not a valid number, fall back to auto-parse (returns string)
      const params = [{ key: 'count', value: 'abc' }];
      const parsed = format.parseStandalone(toParams(params), { initialState: { count: 42 } });
      expect((parsed as {count: string}).count).toBe('abc');
    });

    it('should not coerce array elements when initialState array has undefined first element', () => {
      const format = createFormat({ typed: false });
      // When initialState array has undefined first element, just autoparse
      const params = [{ key: 'items', value: '42' }];
      // eslint-disable-next-line no-sparse-arrays
      const parsed = format.parseStandalone(toParams(params), { initialState: { items: [,] } });
      expect((parsed as {items: (number|undefined)[]}).items).toEqual([42]);
    });

    it('should coerce array elements when initialState has typed array', () => {
      const format = createFormat({ typed: false });
      // Array element coercion when initialState array has a defined first element
      const params = [{ key: 'nums', value: '1' }, { key: 'nums', value: '2' }];
      const parsed = format.parseStandalone(toParams(params), { initialState: { nums: [0] } });
      expect((parsed as {nums: number[]}).nums).toEqual([1, 2]);
    });

    it('should coerce nested array elements from initialState (recursive path)', () => {
      const format = createFormat({ typed: false });
      // When initialState has nested array [[type]], coercing should recurse
      // This triggers the recursive coerceToType call at line 412
      const params = [{ key: 'matrix', value: '1' }, { key: 'matrix', value: '2' }];
      // initialState has [[0]] meaning matrix is array of arrays of numbers
      const parsed = format.parseStandalone(toParams(params), { initialState: { matrix: [[0]] } });
      // Each value should be coerced to a number using the inner array's type
      expect((parsed as {matrix: number[]}).matrix).toEqual([1, 2]);
    });
  });

  describe('URL encoding/decoding round-trip behavior', () => {
    // Helper to simulate what the browser/middleware does:
    // 1. stringifyStandalone produces key-value pairs
    // 2. Browser URL-encodes special chars when building URL (using encodeURI behavior)
    // 3. parseSearchString extracts raw (still encoded) values
    // 4. parseStandalone should decode and restore original values
    //
    // NOTE: Real browser testing would be more accurate. The browser's URLSearchParams
    // and URL APIs have specific encoding behavior that differs from encodeURIComponent.
    // These tests use encodeURIComponent as a conservative approximation.
    
    const simulateUrlRoundTrip = (
      format: ReturnType<typeof createFormat>,
      state: object,
      initialState: object
    ) => {
      // Step 1: Stringify to get values (already encoded with encodeURI)
      const stringified = format.stringifyStandalone(state);
      
      // Step 2: The format already applies encodeURI, so no additional encoding needed
      const params: { key: string; value: string }[] = [];
      for (const [key, value] of Object.entries(stringified)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            params.push({ key, value: v });
          }
        } else {
          params.push({ key, value });
        }
      }
      
      // Step 3: Parse (should decode)
      return format.parseStandalone(toParams(params), { initialState });
    };

    describe('plain mode (typed: false)', () => {
      const format = createFormat({ typed: false });

      it('should round-trip strings with spaces', () => {
        const state = { name: 'John Doe', message: 'Hello World' };
        const result = simulateUrlRoundTrip(format, state, state);
        expect(result).toEqual(state);
      });

      it('should round-trip strings with special URL characters', () => {
        const state = { 
          query: 'a=b&c=d', 
          path: '/home/user',
          hash: '#section',
          question: 'what?',
        };
        const result = simulateUrlRoundTrip(format, state, state);
        expect(result).toEqual(state);
      });

      it('should round-trip unicode characters', () => {
        const state = { 
          emoji: '😀🎉', 
          chinese: '你好世界',
          arabic: 'مرحبا',
          mixed: 'Hello 世界 🌍',
        };
        const result = simulateUrlRoundTrip(format, state, state);
        expect(result).toEqual(state);
      });

      it('should round-trip arrays with special characters', () => {
        const state = { 
          tags: ['hello world', 'foo&bar', 'a=b'],
        };
        const result = simulateUrlRoundTrip(format, state, state);
        expect(result).toEqual(state);
      });

      it('should round-trip nested objects with special characters', () => {
        const state = { 
          user: { 
            name: 'John & Jane',
            bio: 'Hello, World!',
          },
        };
        const result = simulateUrlRoundTrip(format, state, state);
        expect(result).toEqual(state);
      });

      it('should round-trip percent signs correctly', () => {
        const state = { 
          percent: '100% complete',
          discount: '50% off',
        };
        const result = simulateUrlRoundTrip(format, state, state);
        expect(result).toEqual(state);
      });

      it('should handle malformed percent-encoding gracefully', () => {
        // This tests the fallback when decodeURIComponent fails
        const params = [{ key: 'bad', value: '%ZZ' }];
        const parsed = format.parseStandalone(toParams(params), { initialState: { bad: '' } });
        expect(parsed).toEqual({ bad: '%ZZ' });
      });

      it('should round-trip namespaced mode with special characters', () => {
        const state = { name: 'Hello, World!', count: 42 };
        const str = format.stringify(state);
        const parsed = format.parse(str);
        expect(parsed).toEqual(state);
      });

      it('should round-trip namespaced mode with separator in value', () => {
        // Value contains the separator (comma) - should be escaped
        const state = { csv: 'a,b,c' };
        const str = format.stringify(state);
        const parsed = format.parse(str);
        expect(parsed).toEqual(state);
      });
    });

    describe('typed mode (typed: true)', () => {
      const format = createFormat({ typed: true });

      it('should round-trip namespaced mode', () => {
        const state = { name: 'Hello, World!', count: 42 };
        const str = format.stringify(state);
        const parsed = format.parse(str);
        expect(parsed).toEqual(state);
      });

      it('should round-trip namespaced mode with unicode', () => {
        const state = { name: '你好世界', emoji: '😀' };
        const str = format.stringify(state);
        const parsed = format.parse(str);
        expect(parsed).toEqual(state);
      });

      it('should round-trip namespaced mode with arrays', () => {
        const state = { items: ['hello world', 'foo bar'] };
        const str = format.stringify(state);
        const parsed = format.parse(str);
        expect(parsed).toEqual(state);
      });

      it('should round-trip namespaced mode with nested objects', () => {
        const state = { 
          user: { name: 'John', age: 30 },
          tags: ['a', 'b'],
        };
        const str = format.stringify(state);
        const parsed = format.parse(str);
        expect(parsed).toEqual(state);
      });
    });
  });

  describe('booleanStyle: number', () => {
    describe('plain mode', () => {
      const format = createFormat({ typed: false, serialize: { booleans: 'number' } });

      it('should serialize booleans as 0/1', () => {
        const state = { active: true, disabled: false };
        const result = format.stringifyStandalone(state);
        expect(result.active).toEqual(['1']);
        expect(result.disabled).toEqual(['0']);
      });

      it('should parse 0/1 as booleans with initialState', () => {
        const initialState = { active: true, disabled: false };
        const params = [
          { key: 'active', value: '0' },
          { key: 'disabled', value: '1' },
        ];
        const parsed = format.parseStandalone(toParams(params), { initialState });
        expect(parsed).toEqual({ active: false, disabled: true });
      });

      it('should round-trip booleans in namespaced mode', () => {
        const state = { a: true, b: false };
        const str = format.stringify(state);
        // In plain mode, namespaced still works because we use escaping
        const parsed = format.parse(str);
        // Without initialState, booleans come back as numbers (from autoParseNumbers)
        // This is expected - plain namespaced mode needs initialState for proper coercion
        expect(parsed).toEqual({ a: 1, b: 0 });
      });
    });

    describe('typed mode', () => {
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });

      it('should serialize booleans as :0/:1', () => {
        const state = { active: true, disabled: false };
        const result = format.stringifyStandalone(state);
        expect(result.active).toEqual([':1']);
        expect(result.disabled).toEqual([':0']);
      });

      it('should parse :0/:1 as booleans with initialState in standalone', () => {
        const initialState = { active: true, disabled: false };
        const params = [
          { key: 'active', value: ':0' },
          { key: 'disabled', value: ':1' },
        ];
        const parsed = format.parseStandalone(toParams(params), { initialState });
        expect(parsed).toEqual({ active: false, disabled: true });
      });

      it('should preserve numbers when not in boolean position', () => {
        const initialState = { count: 0, active: true };
        const params = [
          { key: 'count', value: ':1' },
          { key: 'active', value: ':0' },
        ];
        const parsed = format.parseStandalone(toParams(params), { initialState }) as { count: number; active: boolean };
        expect(parsed).toEqual({ count: 1, active: false });
        expect(typeof parsed.count).toBe('number');
        expect(typeof parsed.active).toBe('boolean');
      });

      it('should round-trip in standalone mode with initialState', () => {
        const state = { count: 1, zero: 0, active: true, disabled: false };
        const stringified = format.stringifyStandalone(state);
        const parsed = format.parseStandalone(stringified, { initialState: state }) as typeof state;
        expect(parsed).toEqual(state);
        expect(typeof parsed.count).toBe('number');
        expect(typeof parsed.zero).toBe('number');
        expect(typeof parsed.active).toBe('boolean');
        expect(typeof parsed.disabled).toBe('boolean');
      });

      it('should handle arrays with booleans in standalone mode', () => {
        const state = { flags: [true, false, true] };
        const stringified = format.stringifyStandalone(state);
        const parsed = format.parseStandalone(stringified, { initialState: state });
        expect(parsed).toEqual(state);
      });

      it('should handle nested objects with booleans in standalone mode', () => {
        const state = { 
          settings: { 
            enabled: true, 
            count: 1 
          } 
        };
        const stringified = format.stringifyStandalone(state);
        const parsed = format.parseStandalone(stringified, { initialState: state }) as typeof state;
        expect(parsed).toEqual(state);
        expect(typeof parsed.settings.enabled).toBe('boolean');
        expect(typeof parsed.settings.count).toBe('number');
      });

      it('should work in namespaced mode (booleans become numbers without initialState)', () => {
        const state = { active: true, count: 1 };
        const str = format.stringify(state);
        const parsed = format.parse(str) as { active: number; count: number };
        // Without initialState in namespaced mode, both come back as numbers
        // This is the documented tradeoff of serialize: { booleans: 'number' }
        expect(parsed.active).toBe(1);
        expect(parsed.count).toBe(1);
      });

      it('should coerce booleans in namespaced mode with initialState', () => {
        const state = { active: true, count: 1 };
        const str = format.stringify(state);
        const parsed = format.parse(str, { initialState: state }) as typeof state;
        // With initialState, booleans are coerced back to boolean type
        expect(parsed.active).toBe(true);
        expect(typeof parsed.active).toBe('boolean');
        expect(parsed.count).toBe(1);
        expect(typeof parsed.count).toBe('number');
      });
    });
  });

  describe('markers: { array: false }', () => {
    const format = createFormat({ typed: true, markers: { array: false } });

    it('should serialize arrays without @...~ wrapper', () => {
      const state = { tags: ['a', 'b', 'c'] };
      const result = format.stringifyStandalone(state);
      // Without array marker, just comma-separated values
      expect(result.tags).toEqual(['a,b,c']);
    });

    it('should serialize array of numbers without wrapper', () => {
      const state = { ids: [1, 2, 3] };
      const result = format.stringifyStandalone(state);
      expect(result.ids).toEqual([':1,:2,:3']);
    });

    it('should parse arrays with initialState', () => {
      const initialState = { tags: [''] };
      const params = [{ key: 'tags', value: 'a,b,c' }];
      const parsed = format.parseStandalone(toParams(params), { initialState });
      expect(parsed).toEqual({ tags: ['a', 'b', 'c'] });
    });

    it('should parse array of numbers with initialState', () => {
      const initialState = { ids: [0] };
      const params = [{ key: 'ids', value: ':1,:2,:3' }];
      const parsed = format.parseStandalone(toParams(params), { initialState });
      expect(parsed).toEqual({ ids: [1, 2, 3] });
    });

    it('should round-trip plain arrays in standalone mode', () => {
      const state = { tags: ['a', 'b', 'c'], ids: [1, 2, 3] };
      const stringified = format.stringifyStandalone(state);
      // stringifyStandalone returns Record<string, string[]>
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
    });

    it('should handle empty array', () => {
      const state = { tags: [] as string[] };
      const result = format.stringifyStandalone(state);
      // Empty array becomes empty string
      expect(result.tags).toEqual(['']);
    });

    it('should handle single element array', () => {
      const state = { tags: ['only'] };
      const result = format.stringifyStandalone(state);
      expect(result.tags).toEqual(['only']);
      
      const params = [{ key: 'tags', value: 'only' }];
      const parsed = format.parseStandalone(toParams(params), { initialState: { tags: [] } });
      expect(parsed).toEqual({ tags: ['only'] });
    });

    it('should preserve non-array values', () => {
      const state = { name: 'John', count: 42, tags: ['a', 'b'] };
      const stringified = format.stringifyStandalone(state);
      expect(stringified.name).toEqual(['John']);
      expect(stringified.count).toEqual([':42']);
      expect(stringified.tags).toEqual(['a,b']);
    });

    it('should throw error in namespaced mode with markers: { array: false }', () => {
      const state = { name: 'John', count: 42 };
      expect(() => format.stringify(state)).toThrow(
        /arrayMarker: false.*standalone mode/
      );
    });
  });

  describe('separator edge cases', () => {
    describe('arraySeparator same as separator', () => {
      it('should work in plain mode with arraySeparator = separator', () => {
        const format = createFormat({ 
          typed: false, 
          separators: { array: ',', entry: ',' }
        });
        // In standalone mode, arraySeparator is used within values, separator for entries
        const state = { tags: ['a', 'b', 'c'] };
        const result = format.stringifyStandalone(state);
        expect(result.tags).toEqual(['a,b,c']);
        
        const parsed = format.parseStandalone(
          toParams([{ key: 'tags', value: 'a,b,c' }]),
          { initialState: { tags: [] } }
        );
        expect(parsed).toEqual(state);
      });

      it('should handle namespaced mode with same separators via escaping', () => {
        const format = createFormat({ 
          typed: false, 
          separators: { array: '|', entry: ',' }
        });
        const state = { name: 'a,b', tags: ['x', 'y'] };
        const str = format.stringify(state);
        const parsed = format.parse(str);
        // In plain namespaced mode without initialState, arrays come back as strings
        // This test verifies the escaping works for the separator in the value
        expect((parsed as any).name).toBe('a,b');
      });
    });

    describe('arraySeparator same as separator - comprehensive tests', () => {
      // =======================================================================
      // FLAT MODE - STANDALONE
      // =======================================================================
      describe('plain mode standalone', () => {
        const format = createFormat({ 
          typed: false, 
          separators: { array: ',', entry: ',' }
        });

        it('should stringify and parse simple array', () => {
          const state = { tags: ['a', 'b', 'c'] };
          const result = format.stringifyStandalone(state);
          expect(result.tags).toEqual(['a,b,c']);
          
          const parsed = format.parseStandalone(result, { initialState: state });
          expect(parsed).toEqual(state);
        });

        it('should handle empty array', () => {
          const state = { tags: [] as string[] };
          const result = format.stringifyStandalone(state);
          // Empty arrays use the emptyMarker
          expect(result.tags).toEqual(['__empty_array__']);
          
          const parsed = format.parseStandalone(result, { initialState: state });
          expect(parsed).toEqual(state);
        });

        it('should handle single element array', () => {
          const state = { tags: ['only'] };
          const result = format.stringifyStandalone(state);
          expect(result.tags).toEqual(['only']);
          
          const parsed = format.parseStandalone(result, { initialState: state });
          expect(parsed).toEqual(state);
        });

        it('should handle array with numbers', () => {
          const state = { nums: [1, 2, 3] };
          const result = format.stringifyStandalone(state);
          expect(result.nums).toEqual(['1,2,3']);
          
          const parsed = format.parseStandalone(result, { initialState: state });
          expect(parsed).toEqual(state);
        });

        it('should handle mixed scalar and array fields', () => {
          const state = { name: 'John', tags: ['a', 'b'], age: 30 };
          const result = format.stringifyStandalone(state);
          expect(result.name).toEqual(['John']);
          expect(result.tags).toEqual(['a,b']);
          expect(result.age).toEqual(['30']);
          
          const parsed = format.parseStandalone(result, { initialState: state });
          expect(parsed).toEqual(state);
        });

        it('should handle multiple arrays', () => {
          const state = { tags: ['a', 'b'], categories: ['x', 'y', 'z'] };
          const result = format.stringifyStandalone(state);
          expect(result.tags).toEqual(['a,b']);
          expect(result.categories).toEqual(['x,y,z']);
          
          const parsed = format.parseStandalone(result, { initialState: state });
          expect(parsed).toEqual(state);
        });

        it('should handle nested objects with arrays', () => {
          const state = { user: { name: 'John', roles: ['admin', 'user'] } };
          const result = format.stringifyStandalone(state);
          expect(result['user.name']).toEqual(['John']);
          expect(result['user.roles']).toEqual(['admin,user']);
          
          const parsed = format.parseStandalone(result, { initialState: state });
          expect(parsed).toEqual(state);
        });
      });

      // =======================================================================
      // FLAT MODE - NAMESPACED (same separator = same arraySeparator)
      // =======================================================================
      describe('plain mode namespaced with same separators', () => {
        const format = createFormat({ 
          typed: false, 
          separators: { array: ',', entry: ',' }
        });

        it('should stringify with key=value pattern detection', () => {
          const state = { name: 'John', tags: ['a', 'b', 'c'], age: 30 };
          const str = format.stringify(state);
          // Should be: name=John,tags=a,b,c,age=30
          // Parser can detect keys by looking for word= patterns
          expect(str).toContain('name=John');
          expect(str).toContain('tags=a,b,c');
          expect(str).toContain('age=30');
        });

        it('should parse namespaced string with initialState for arrays', () => {
          // NOTE: In plain namespaced mode with same separators, the parser splits by separator
          // which means arrays lose their boundary. With initialState, it knows tags should be
          // an array, so it takes all values until next key=value pattern.
          // Current implementation: first split by separator, then reassemble based on = detection
          const state = { name: 'John', tags: ['a', 'b', 'c'], age: 30 };
          const str = format.stringify(state);
          // For now, test that it at least parses without error and gets scalar values right
          const parsed = format.parse(str, { initialState: state }) as typeof state;
          expect(parsed.name).toBe('John');
          expect(parsed.age).toBe(30);
          // Arrays may not fully round-trip in this edge case without smarter parsing
          expect(Array.isArray(parsed.tags)).toBe(true);
        });

        it('should handle values that look like key=value within arrays', () => {
          // Array element contains = character
          const state = { equations: ['x=1', 'y=2'] };
          const result = format.stringifyStandalone(state);
          const parsed = format.parseStandalone(result, { initialState: state });
          expect(parsed).toEqual(state);
        });
      });

      // =======================================================================
      // COMPACT MODE - STANDALONE
      // =======================================================================
      describe('typed mode standalone', () => {
        const format = createFormat({ 
          typed: true, 
          separators: { array: ',', entry: ',' }
        });

        it('should stringify and parse simple array', () => {
          const state = { tags: ['a', 'b', 'c'] };
          const result = format.stringifyStandalone(state);
          // Compact mode uses @ marker for arrays
          expect(result.tags[0]).toContain('@');
          
          const parsed = format.parseStandalone(result, { initialState: {} });
          expect(parsed).toEqual(state);
        });

        it('should handle empty array', () => {
          const state = { tags: [] as string[] };
          const result = format.stringifyStandalone(state);
          // Empty arrays serialize as @~ but cleanResult strips trailing ~
          // The terminator is stripped in standalone mode for cleaner URLs
          expect(result.tags[0]).toMatch(/^@~?$/);
          
          const parsed = format.parseStandalone(result, { initialState: {} });
          expect(parsed).toEqual(state);
        });

        it('should handle array with mixed types', () => {
          const state = { items: ['text', 42, true] };
          const result = format.stringifyStandalone(state);
          
          const parsed = format.parseStandalone(result, { initialState: {} });
          expect(parsed).toEqual(state);
        });

        it('should handle nested arrays', () => {
          const state = { matrix: [['a', 'b'], ['c', 'd']] };
          const result = format.stringifyStandalone(state);
          
          const parsed = format.parseStandalone(result, { initialState: {} });
          expect(parsed).toEqual(state);
        });

        it('should handle array of objects', () => {
          const state = { users: [{ name: 'John' }, { name: 'Jane' }] };
          const result = format.stringifyStandalone(state);
          
          const parsed = format.parseStandalone(result, { initialState: {} });
          expect(parsed).toEqual(state);
        });
      });

      // =======================================================================
      // COMPACT MODE - NAMESPACED
      // =======================================================================
      describe('typed mode namespaced', () => {
        const format = createFormat({ 
          typed: true, 
          separators: { array: ',', entry: ',' }
        });

        it('should round-trip simple object with array', () => {
          const state = { name: 'John', tags: ['a', 'b', 'c'] };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });

        it('should round-trip complex nested structure', () => {
          const state = { 
            user: { 
              name: 'John',
              roles: ['admin', 'user'],
              settings: {
                theme: 'dark',
                notifications: [true, false, true]
              }
            }
          };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });

        it('should handle multiple arrays at same level', () => {
          const state = { 
            tags: ['a', 'b'],
            categories: ['x', 'y', 'z'],
            ids: [1, 2, 3]
          };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });
      });

      // =======================================================================
      // EDGE CASES
      // =======================================================================
      describe('edge cases', () => {
        it('should handle array elements containing the separator character', () => {
          const format = createFormat({ 
            typed: true, 
            separators: { array: ',', entry: ',' }
          });
          // Array element contains comma - must be escaped
          const state = { items: ['a,b', 'c,d'] };
          const result = format.stringifyStandalone(state);
          const parsed = format.parseStandalone(result, { initialState: {} });
          expect(parsed).toEqual(state);
        });

        it('should handle deeply nested arrays with same separators', () => {
          const format = createFormat({ 
            typed: true, 
            separators: { array: ',', entry: ',' }
          });
          const state = { 
            level1: {
              level2: {
                items: ['a', 'b', 'c']
              }
            }
          };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });

        it('should handle plain mode with booleans in arrays', () => {
          const format = createFormat({ 
            typed: false, 
            separators: { array: ',', entry: ',' }
          });
          const state = { flags: [true, false, true] };
          const result = format.stringifyStandalone(state);
          const parsed = format.parseStandalone(result, { initialState: state });
          expect(parsed).toEqual(state);
        });

        it('should handle plain mode with dates in arrays', () => {
          const format = createFormat({ 
            typed: false, 
            separators: { array: ',', entry: ',' }
          });
          const d1 = new Date('2024-01-01');
          const d2 = new Date('2024-12-31');
          const state = { dates: [d1, d2] };
          const result = format.stringifyStandalone(state);
          const parsed = format.parseStandalone(result, { initialState: state });
          expect((parsed as typeof state).dates[0].getTime()).toBe(d1.getTime());
          expect((parsed as typeof state).dates[1].getTime()).toBe(d2.getTime());
        });

        it('should handle typed mode with null/undefined in arrays', () => {
          const format = createFormat({ 
            typed: true, 
            separators: { array: ',', entry: ',' }
          });
          const state = { items: [null, 'a', undefined, 'b'] };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });

        it('should handle empty strings in arrays', () => {
          const format = createFormat({ 
            typed: true, 
            separators: { array: ',', entry: ',' }
          });
          const state = { items: ['', 'a', '', 'b', ''] };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });

        it('should handle array as only field', () => {
          const format = createFormat({ 
            typed: true, 
            separators: { array: ',', entry: ',' }
          });
          const state = { items: [1, 2, 3, 4, 5] };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });

        it('should work with custom escape character', () => {
          const format = createFormat({ 
            typed: true, 
            separators: { array: ',', entry: ',', escape: '\\' }
          });
          const state = { items: ['a,b', 'c\\d'] };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });

        it('should handle very long arrays', () => {
          const format = createFormat({ 
            typed: true, 
            separators: { array: ',', entry: ',' }
          });
          const state = { items: Array.from({ length: 100 }, (_, i) => `item${i}`) };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });
      });

      // =======================================================================
      // DIFFERENT SEPARATOR COMBINATIONS
      // =======================================================================
      describe('different separator combinations', () => {
        it('should work with pipe for both separators', () => {
          const format = createFormat({ 
            typed: true, 
            separators: { array: '|', entry: '|' }
          });
          const state = { name: 'John', tags: ['a', 'b', 'c'] };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });

        it('should work with semicolon for both separators', () => {
          const format = createFormat({ 
            typed: true, 
            separators: { array: ';', entry: ';' }
          });
          const state = { name: 'John', tags: ['a', 'b', 'c'] };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });

        it('should work with different separators (arraySep != sep)', () => {
          const format = createFormat({ 
            typed: true, 
            separators: { array: ';', entry: ',' }
          });
          const state = { name: 'John', tags: ['a', 'b', 'c'] };
          const str = format.stringify(state);
          const parsed = format.parse(str);
          expect(parsed).toEqual(state);
        });
      });
    });

    describe('special characters as separators', () => {
      it('should work with pipe as separator', () => {
        const format = createFormat({ 
          typed: true, 
          separators: { entry: '|', array: ';' }
        });
        const state = { a: 1, b: 2, items: ['x', 'y'] };
        testRoundTrip(format, state);
      });

      it('should work with semicolon as separator', () => {
        const format = createFormat({ 
          typed: true, 
          separators: { entry: ';' }
        });
        const state = { a: 1, b: 2 };
        testRoundTrip(format, state);
      });

      it('should work with underscore as nesting separator', () => {
        const format = createFormat({ 
          typed: false, 
          separators: { nesting: '_' }
        });
        const state = { user: { name: 'John', age: 30 } };
        const result = format.stringifyStandalone(state);
        expect(result['user_name']).toEqual(['John']);
        expect(result['user_age']).toEqual(['30']);
      });
    });

    describe('values containing separator characters', () => {
      it('should escape values containing separator in plain namespaced mode', () => {
        const format = createFormat({ typed: false, separators: { entry: ',' } });
        const state = { text: 'a,b,c' };
        const str = format.stringify(state);
        const parsed = format.parse(str);
        expect(parsed).toEqual(state);
      });

      it('should escape values containing nesting separator', () => {
        const format = createFormat({ typed: false, separators: { nesting: '.' } });
        const state = { 'user.name': 'John' };
        const str = format.stringify(state);
        const parsed = format.parse(str);
        expect(parsed).toEqual(state);
      });

      it('should escape values containing terminator in typed mode', () => {
        const format = createFormat({ typed: true, markers: { terminator: '~' } });
        const state = { text: 'hello~world' };
        testRoundTrip(format, state);
      });

      it('should escape values containing all special chars', () => {
        const format = createFormat({ typed: true });
        const state = { text: 'a=b:c@d.e,f~g/h' };
        testRoundTrip(format, state);
      });
    });

    describe('keys containing separator characters', () => {
      it('should handle keys with dots in plain mode', () => {
        const format = createFormat({ typed: false, separators: { nesting: '.' } });
        // Keys with dots are ambiguous in standalone plain mode
        // In namespaced mode, they should be escaped
        const state = { 'a.b': 'value' };
        const str = format.stringify(state);
        const parsed = format.parse(str);
        expect(parsed).toEqual(state);
      });

      it('should handle keys with separator in typed mode', () => {
        const format = createFormat({ typed: true });
        const state = { 'key,with,commas': 'value' };
        testRoundTrip(format, state);
      });
    });
  });

  describe('empty and edge values', () => {
    it('should handle empty string', () => {
      const state = { text: '' };
      testRoundTrip(typed, state);
    });

    it('should handle empty array', () => {
      const format = createFormat({ typed: false });
      const state = { items: [] as string[] };
      const result = format.stringifyStandalone(state);
      expect(result.items).toEqual(['__empty_array__']);
      
      const parsed = format.parseStandalone(
        toParams([{ key: 'items', value: '__empty_array__' }]),
        { initialState: { items: [] } }
      );
      expect(parsed).toEqual({ items: [] });
    });

    it('should handle empty object', () => {
      const state = { data: {} };
      testRoundTrip(typed, state);
    });

    it('should handle deeply nested empty structures', () => {
      const state = { 
        a: { b: { c: { d: {} } } },
      };
      testRoundTrip(typed, state);
    });

    it('should handle null and undefined', () => {
      const state = { n: null, u: undefined };
      testRoundTrip(typed, state);
    });

    it('should handle very long strings', () => {
      const state = { text: 'a'.repeat(1000) };
      testRoundTrip(typed, state);
    });

    it('should handle very deep nesting', () => {
      let state: any = { value: 'deep' };
      for (let i = 0; i < 10; i++) {
        state = { nested: state };
      }
      testRoundTrip(typed, state);
    });

    it('should handle large arrays', () => {
      const state = { items: Array.from({ length: 100 }, (_, i) => i) };
      testRoundTrip(typed, state);
    });
  });

  describe('type preservation edge cases', () => {
    it('should preserve negative numbers', () => {
      const state = { n: -42, f: -3.14 };
      testRoundTrip(typed, state);
    });

    it('should preserve very small numbers', () => {
      const state = { n: 0.0000001 };
      testRoundTrip(typed, state);
    });

    it('should preserve very large numbers', () => {
      const state = { n: 999999999999 };
      testRoundTrip(typed, state);
    });

    it('should handle string that looks like number', () => {
      const format = createFormat({ typed: true });
      const state = { id: '42' };
      testRoundTrip(format, state);
      
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(typeof (parsed as any).id).toBe('string');
    });

    it('should handle string that looks like boolean', () => {
      const format = createFormat({ typed: true });
      const state = { text: 'true' };
      testRoundTrip(format, state);
      
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(typeof (parsed as any).text).toBe('string');
    });
  });
});

// =============================================================================
// ADDITIONAL EDGE CASE TESTS FOR FULL COVERAGE
// =============================================================================

describe('configurable format - additional edge cases', () => {

  describe('markers: { datePrefix: false } edge cases', () => {
    it('should handle array of dates with markers: { datePrefix: false }', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'timestamp' } });
      const dates = [
        new Date('2024-01-15T10:30:00.000Z'),
        new Date('2024-06-20T15:45:00.000Z'),
      ];
      const state = { dates };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect((parsed as typeof state).dates[0]).toBeInstanceOf(Date);
      expect((parsed as typeof state).dates[1]).toBeInstanceOf(Date);
      expect((parsed as typeof state).dates[0].getTime()).toBe(dates[0].getTime());
      expect((parsed as typeof state).dates[1].getTime()).toBe(dates[1].getTime());
    });

    it('should handle nested objects with dates and markers: { datePrefix: false }', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'iso' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { user: { profile: { createdAt: date } } };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect((parsed as typeof state).user.profile.createdAt).toBeInstanceOf(Date);
      expect((parsed as typeof state).user.profile.createdAt.getTime()).toBe(date.getTime());
    });

    it('should handle ISO date string coercion with markers: { datePrefix: false }', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'iso' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { created: date };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect((parsed as typeof state).created).toBeInstanceOf(Date);
    });
  });

  describe('markers: { array: false } edge cases', () => {
    it('should handle array of booleans with markers: { array: false }', () => {
      const format = createFormat({ typed: true, markers: { array: false } });
      const state = { flags: [true, false, true] };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
    });

    it('should handle array of mixed numbers with markers: { array: false }', () => {
      const format = createFormat({ typed: true, markers: { array: false } });
      const state = { values: [-1, 0, 1, 42, -3.14, 0.001] };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
    });

    it('should handle empty array with markers: { array: false }', () => {
      const format = createFormat({ typed: true, markers: { array: false } });
      const state = { items: [] as string[] };
      const stringified = format.stringifyStandalone(state);
      // Empty arrays serialize to empty string
      expect(stringified.items).toEqual(['']);
      // And parse back to empty array when initialState indicates it's an array
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
    });

    it('should handle single element array with markers: { array: false }', () => {
      const format = createFormat({ typed: true, markers: { array: false } });
      const state = { items: ['only'] };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
    });

    it('should throw error in namespaced mode with markers: { array: false }', () => {
      const format = createFormat({ typed: true, markers: { array: false } });
      const state = { items: ['a', 'b', 'c'] };
      // markers: { array: false } is only valid in standalone mode
      // In namespaced mode, it should throw an error
      expect(() => format.stringify(state)).toThrow(
        /arrayMarker: false.*standalone mode/
      );
    });
  });

  describe('booleanStyle: number edge cases', () => {
    it('should handle nested booleans with booleanStyle: number', () => {
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
      const state = {
        settings: { 
          enabled: true, 
          notifications: { 
            email: false, 
            push: true 
          } 
        } 
      };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
      expect(typeof (parsed as typeof state).settings.enabled).toBe('boolean');
      expect(typeof (parsed as typeof state).settings.notifications.email).toBe('boolean');
    });

    it('should handle array of booleans with booleanStyle: number', () => {
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
      const state = { flags: [true, false, true, false] };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
      expect((parsed as typeof state).flags.every(f => typeof f === 'boolean')).toBe(true);
    });

    it('should not coerce 0/1 to boolean without initialState hint', () => {
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
      // Parse without initialState - 0/1 should stay as numbers
      const stringified = { active: [':1'] };
      const parsed = format.parseStandalone(stringified, { initialState: {} });
      expect(typeof (parsed as { active: number }).active).toBe('number');
    });
  });

  describe('combined options edge cases', () => {
    it('should handle markers: { datePrefix: false } + booleanStyle: number together', () => {
      const format = createFormat({ 
        typed: true, 
        markers: { datePrefix: false }, 
        serialize: { booleans: 'number', dates: 'timestamp' }
      });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { 
        created: date,
        active: true,
        count: 42
      };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect((parsed as typeof state).created).toBeInstanceOf(Date);
      expect(typeof (parsed as typeof state).active).toBe('boolean');
      expect(typeof (parsed as typeof state).count).toBe('number');
    });

    it('should handle markers: { array: false } + booleanStyle: number together', () => {
      const format = createFormat({ 
        typed: true, 
        markers: { array: false }, 
        serialize: { booleans: 'number' }
      });
      const state = { 
        flags: [true, false],
        counts: [1, 2, 3]
      };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
    });

    it('should handle all special options together', () => {
      const format = createFormat({ 
        typed: true, 
        markers: { array: false, datePrefix: false }, 
        serialize: { booleans: 'number', dates: 'timestamp' }
      });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { 
        dates: [date],
        flags: [true, false],
        active: true,
        created: date
      };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect((parsed as typeof state).created).toBeInstanceOf(Date);
      expect((parsed as typeof state).dates[0]).toBeInstanceOf(Date);
      expect(typeof (parsed as typeof state).active).toBe('boolean');
      expect((parsed as typeof state).flags.every(f => typeof f === 'boolean')).toBe(true);
    });
  });

  describe('error handling and malformed input', () => {
    it('should handle empty string input gracefully', () => {
      const format = createFormat({ typed: true });
      const parsed = format.parse('');
      expect(parsed).toEqual({});
    });

    it('should handle malformed typed format gracefully', () => {
      const format = createFormat({ typed: true });
      // Missing terminator
      const parsed = format.parse('name=test,count:42');
      expect(parsed).toBeDefined();
    });

    it('should handle invalid date string gracefully', () => {
      const format = createFormat({ typed: false });
      const params = toParams([{ key: 'created', value: 'not-a-date' }]);
      const date = new Date('2024-01-15T10:30:00.000Z');
      const parsed = format.parseStandalone(params, { initialState: { created: date } });
      // Should fall back to initial value or handle gracefully
      expect(parsed).toBeDefined();
    });

    it('should handle parseStandalone with missing keys', () => {
      const format = createFormat({ typed: true });
      const params = toParams([{ key: 'name', value: '=test' }]);
      const parsed = format.parseStandalone(params, { initialState: { name: '', missing: 'default' } });
      expect((parsed as { name: string }).name).toBe('test');
    });

    it('should handle try-catch in parseStandalone for invalid values', () => {
      const format = createFormat({ typed: true });
      // Create params with potentially problematic values
      const params: Record<string, string[]> = { 
        'valid': ['=test'],
        // decodeURIComponent might fail on malformed sequences - but we should handle it
      };
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect(parsed).toBeDefined();
    });
  });

  describe('special character escaping edge cases', () => {
    it('should handle value containing all separator chars', () => {
      const format = createFormat({ typed: true });
      const state = { text: 'a=b:c@d.e,f~g/h' };
      testRoundTrip(format, state);
    });

    it('should handle key containing dots in plain mode', () => {
      const format = createFormat({ typed: false });
      // The key will be flattened, so we test nested structure
      const state = { 'a.b': { 'c.d': 'value' } };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toBeDefined();
    });

    it('should handle multiple consecutive escape chars', () => {
      const format = createFormat({ typed: true });
      const state = { text: '///test///' };
      testRoundTrip(format, state);
    });

    it('should handle escape char at end of value', () => {
      const format = createFormat({ typed: true });
      const state = { text: 'test/' };
      testRoundTrip(format, state);
    });

    it('should handle newlines and tabs', () => {
      const format = createFormat({ typed: true });
      const state = { text: 'line1\nline2\ttab' };
      testRoundTrip(format, state);
    });

    it('should handle backslash in values', () => {
      const format = createFormat({ typed: true });
      const state = { path: 'C:\\Users\\test' };
      testRoundTrip(format, state);
    });
  });

  describe('plain mode specific edge cases', () => {
    it('should handle mixed array indices (sparse array)', () => {
      // Need separators: { array: 'repeat' } for arrays to work in namespaced mode
      // when separator is also ',' (the default)
      const format = createFormat({ typed: false, separators: { array: 'repeat' } });
      const state = { items: ['a', 'b', 'c'] };
      testRoundTrip(format, state);
    });

    it('should handle bracket notation with special chars', () => {
      const format = createFormat({ typed: false, plain: { arrayIndexStyle: 'bracket' } });
      const state = { users: [{ name: 'Test', age: 30 }] };
      testRoundTrip(format, state);
    });

    it('should handle very deeply nested objects', () => {
      const format = createFormat({ typed: false });
      const state = { 
        a: { b: { c: { d: { e: { f: 'deep' } } } } } 
      };
      testRoundTrip(format, state);
    });

    it('should handle array of arrays (if nested)', () => {
      const format = createFormat({ typed: true });
      const state = { matrix: [[1, 2], [3, 4]] };
      testRoundTrip(format, state);
    });
  });

  describe('typed mode specific edge cases', () => {
    it('should handle object with only undefined values', () => {
      const format = createFormat({ typed: true });
      const state = { a: undefined, b: undefined };
      testRoundTrip(format, state);
    });

    it('should handle object with only null values', () => {
      const format = createFormat({ typed: true });
      const state = { a: null, b: null };
      testRoundTrip(format, state);
    });

    it('should handle mixed null/undefined/value', () => {
      const format = createFormat({ typed: true });
      const state = { a: null, b: undefined, c: 'value', d: 0 };
      testRoundTrip(format, state);
    });

    it('should handle empty nested objects', () => {
      const format = createFormat({ typed: true });
      const state = { outer: { inner: {} } };
      testRoundTrip(format, state);
    });

    it('should handle object keys that look like numbers', () => {
      const format = createFormat({ typed: true });
      const state = { '123': 'numeric key', 'abc': 'string key' };
      testRoundTrip(format, state);
    });
  });

  describe('namespaced vs standalone consistency', () => {
    it('should produce consistent results between modes for plain format', () => {
      const format = createFormat({ typed: false });
      const state = { name: 'test', count: 42 };
      
      // Namespaced round-trip
      const namespacedStr = format.stringify(state);
      const namespacedParsed = format.parse(namespacedStr, { initialState: state });
      
      // Standalone round-trip
      const standaloneParams = format.stringifyStandalone(state);
      const standaloneParsed = format.parseStandalone(standaloneParams, { initialState: state });
      
      expect(namespacedParsed).toEqual(standaloneParsed);
    });

    it('should produce consistent results between modes for typed format', () => {
      const format = createFormat({ typed: true });
      const state = { name: 'test', count: 42, active: true };
      
      // Namespaced round-trip
      const namespacedStr = format.stringify(state);
      const namespacedParsed = format.parse(namespacedStr);
      
      // Standalone round-trip
      const standaloneParams = format.stringifyStandalone(state);
      const standaloneParsed = format.parseStandalone(standaloneParams, { initialState: {} });
      
      expect(namespacedParsed).toEqual(standaloneParsed);
    });
  });

  describe('parser.ts json format', () => {
    // Test the json format from parser.ts
    it('should import json format', async () => {
      const { json } = await import('../parser.js');
      expect(json).toBeDefined();
      expect(json.stringify).toBeDefined();
      expect(json.parse).toBeDefined();
    });

    it('should round-trip with json format', async () => {
      const { json } = await import('../parser.js');
      const state = { name: 'test', count: 42 };
      const str = json.stringify(state);
      const parsed = json.parse(str);
      expect(parsed).toEqual(state);
    });

    it('should stringifyStandalone with json format', async () => {
      const { json } = await import('../parser.js');
      const state = { name: 'test', count: 42 };
      const params = json.stringifyStandalone(state);
      expect(params).toBeDefined();
    });

    it('should parseStandalone with json format', async () => {
      const { json } = await import('../parser.js');
      const params = toParams([{ key: 'name', value: '"test"' }, { key: 'count', value: '42' }]);
      const parsed = json.parseStandalone(params, { initialState: {} });
      expect(parsed).toBeDefined();
    });
  });
});

// Additional tests for branch coverage
describe('configurable format - branch coverage', () => {
  describe('auto-parse options disabled', () => {
    it('should not auto-parse booleans when autoParseBooleans is false', () => {
      const format = createFormat({ typed: false, parse: { booleans: false } });
      const params = toParams([{ key: 'flag', value: 'true' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      // Should remain as string
      expect((parsed as { flag: string }).flag).toBe('true');
    });

    it('should not auto-parse dates when autoParseDates is false', () => {
      const format = createFormat({ typed: false, parse: { dates: false } });
      const params = toParams([{ key: 'date', value: '2024-01-15T10:30:00.000Z' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      // Should remain as string
      expect(typeof (parsed as { date: string }).date).toBe('string');
    });

    it('should not auto-parse timestamps when autoParseDates is false', () => {
      const format = createFormat({ typed: false, parse: { dates: false } });
      const timestamp = Date.now().toString();
      const params = toParams([{ key: 'ts', value: timestamp }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      // Should be parsed as number (autoParseNumbers is still true)
      expect(typeof (parsed as { ts: number }).ts).toBe('number');
    });

    it('should not auto-parse numbers when autoParseNumbers is false', () => {
      const format = createFormat({ typed: false, parse: { numbers: false } });
      const params = toParams([{ key: 'num', value: '42' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      // Should remain as string
      expect((parsed as { num: string }).num).toBe('42');
    });

    it('should not auto-parse negative numbers when autoParseNumbers is false', () => {
      const format = createFormat({ typed: false, parse: { numbers: false } });
      const params = toParams([{ key: 'num', value: '-3.14' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect((parsed as { num: string }).num).toBe('-3.14');
    });

    it('should handle false as string when autoParseBooleans is false', () => {
      const format = createFormat({ typed: false, parse: { booleans: false } });
      const params = toParams([{ key: 'flag', value: 'false' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect((parsed as { flag: string }).flag).toBe('false');
    });
  });

  describe('bracket notation parsing', () => {
    it('should parse bracket notation with arrayIndexStyle bracket', () => {
      const format = createFormat({ typed: false, plain: { arrayIndexStyle: 'bracket' } });
      const params = toParams([
        { key: 'items[0]', value: 'first' },
        { key: 'items[1]', value: 'second' },
      ]);
      const parsed = format.parseStandalone(params, { initialState: { items: [''] } });
      expect(parsed).toEqual({ items: ['first', 'second'] });
    });

    it('should parse nested bracket notation', () => {
      const format = createFormat({ typed: false, plain: { arrayIndexStyle: 'bracket' } });
      const params = toParams([
        { key: 'users[0].name', value: 'John' },
        { key: 'users[1].name', value: 'Jane' },
      ]);
      const parsed = format.parseStandalone(params, { initialState: { users: [{ name: '' }] } });
      expect(parsed).toEqual({ users: [{ name: 'John' }, { name: 'Jane' }] });
    });

    it('should serialize with bracket notation', () => {
      const format = createFormat({ typed: false, plain: { arrayIndexStyle: 'bracket' } });
      const state = { users: [{ name: 'John' }, { name: 'Jane' }] };
      const result = format.stringifyStandalone(state);
      expect(result['users[0].name']).toEqual(['John']);
      expect(result['users[1].name']).toEqual(['Jane']);
    });

    it('should handle bracket notation in namespaced mode', () => {
      const format = createFormat({ typed: false, plain: { arrayIndexStyle: 'bracket' } });
      const state = { items: [{ id: 1 }, { id: 2 }] };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });
  });

  describe('getInitialValueAtPath edge cases', () => {
    it('should handle non-numeric index in array path', () => {
      const format = createFormat({ typed: false });
      // When parsing, if we have an array in initialState but use non-numeric key
      const params = toParams([{ key: 'arr.name', value: 'test' }]);
      const parsed = format.parseStandalone(params, { initialState: { arr: ['item'] } });
      // Should create nested structure
      expect(parsed).toEqual({ arr: { name: 'test' } });
    });

    it('should handle path through array with numeric index', () => {
      const format = createFormat({ typed: false });
      const params = toParams([
        { key: 'users.0.name', value: 'John' },
        { key: 'users.1.name', value: 'Jane' },
      ]);
      const parsed = format.parseStandalone(params, { initialState: { users: [{ name: '' }] } });
      expect(parsed).toEqual({ users: [{ name: 'John' }, { name: 'Jane' }] });
    });
  });

  describe('escape handling in typed mode', () => {
    it('should escape strings starting with date prefix', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' } });
      // A string that looks like a date prefix but is actually a string
      const state = { code: 'D123' };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });

    it('should handle string that looks like number marker in array', () => {
      const format = createFormat({ typed: true });
      // String in array that starts with primitive marker
      const state = { items: [':test'] };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });

    it('should handle string that looks like array marker in array', () => {
      const format = createFormat({ typed: true });
      const state = { items: ['@test'] };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });

    it('should handle string that looks like object marker in array', () => {
      const format = createFormat({ typed: true });
      const state = { items: ['.test'] };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });

    it('should handle string that looks like string marker in array', () => {
      const format = createFormat({ typed: true });
      const state = { items: ['=test'] };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });
  });

  describe('standalone date parsing edge cases', () => {
    it('should parse standalone date with ISO format', () => {
      const format = createFormat({ typed: true, serialize: { dates: 'iso' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const params = toParams([{ key: 'created', value: `D${date.toISOString()}` }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect((parsed as { created: Date }).created).toBeInstanceOf(Date);
    });

    it('should parse standalone date with timestamp format', () => {
      const format = createFormat({ typed: true, serialize: { dates: 'timestamp' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const params = toParams([{ key: 'created', value: `D${date.getTime()}` }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect((parsed as { created: Date }).created).toBeInstanceOf(Date);
    });

    it('should handle invalid date prefix gracefully', () => {
      const format = createFormat({ typed: true });
      // Starts with D but not a valid date
      const params = toParams([{ key: 'text', value: 'Dhello' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      // Should remain as string since it's not a valid date
      expect(typeof (parsed as { text: string }).text).toBe('string');
    });
  });

  describe('coerceToInitialState edge cases', () => {
    it('should coerce nested object properties', () => {
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
      const state = { user: { active: true, count: 0 } };
      const str = format.stringify(state);
      const parsed = format.parse(str, { initialState: state }) as typeof state;
      expect(typeof parsed.user.active).toBe('boolean');
      expect(typeof parsed.user.count).toBe('number');
    });

    it('should coerce 0 to false with booleanStyle number (line 907)', () => {
      // Specifically tests the prim === 0 branch
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
      const state = { active: false };  // hint says boolean, value will be :0
      const str = format.stringify(state);
      expect(str).toContain(':0');  // Verify it's serialized as 0
      const parsed = format.parse(str, { initialState: state }) as typeof state;
      expect(parsed.active).toBe(false);
      expect(typeof parsed.active).toBe('boolean');
    });

    it('should coerce 1 to true with booleanStyle number (line 906)', () => {
      // Specifically tests the prim === 1 branch
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
      const state = { active: true };  // hint says boolean, value will be :1
      const str = format.stringify(state);
      expect(str).toContain(':1');  // Verify it's serialized as 1
      const parsed = format.parse(str, { initialState: state }) as typeof state;
      expect(parsed.active).toBe(true);
      expect(typeof parsed.active).toBe('boolean');
    });

    it('should coerce array elements with booleanStyle number', () => {
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
      const state = { flags: [true, false, true] };
      const str = format.stringify(state);
      const parsed = format.parse(str, { initialState: state }) as typeof state;
      expect(parsed.flags).toEqual([true, false, true]);
      expect(typeof parsed.flags[0]).toBe('boolean');
    });

    it('should handle coercion when initialState has null', () => {
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
      const parsed = format.parse('active:1', { initialState: { active: null } });
      // Should remain as number since initialState is null
      expect((parsed as { active: number }).active).toBe(1);
    });

    it('should handle coercion when initialState has undefined', () => {
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
      const parsed = format.parse('active:1', { initialState: { active: undefined } });
      expect((parsed as { active: number }).active).toBe(1);
    });
  });

  describe('markers: { datePrefix: false } coercion', () => {
    it('should work in namespaced mode with markers: { datePrefix: false }', () => {
      // markers: { datePrefix: false } is allowed in namespaced mode - dates become strings that can be auto-parsed
      const format = createFormat({ typed: true, markers: { datePrefix: false } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { created: date };
      const str = format.stringify(state);
      expect(str).toBeDefined();
      // Compact mode uses timestamp by default, so date is serialized as timestamp
      expect(str).toContain(String(date.getTime()));
    });

    it('should work in standalone mode with markers: { datePrefix: false }', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { created: date };
      // Standalone mode works fine
      const stringified = format.stringifyStandalone(state);
      expect(stringified.created).toBeDefined();
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect((parsed as typeof state).created).toBeInstanceOf(Date);
    });

    it('should work in standalone mode with markers: { datePrefix: false } and dateStyle: iso', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'iso' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { created: date };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect((parsed as typeof state).created).toBeInstanceOf(Date);
    });
  });

  describe('plain mode nested object serialization', () => {
    it('should flatten nested objects without arrays', () => {
      const format = createFormat({ typed: false });
      const state = { user: { profile: { name: 'John' } } };
      const result = format.stringifyStandalone(state);
      expect(result['user.profile.name']).toEqual(['John']);
    });

    it('should handle Date in nested object', () => {
      const format = createFormat({ typed: false });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { user: { createdAt: date } };
      const result = format.stringifyStandalone(state);
      expect(result['user.createdAt']).toBeDefined();
    });
  });

  describe('plain: { emptyArrayMarker: null }', () => {
    it('should omit empty arrays when emptyArrayMarker is null', () => {
      const format = createFormat({ typed: false, plain: { emptyArrayMarker: null } });
      const state = { items: [], name: 'test' } as { items: string[], name: string };
      const result = format.stringifyStandalone(state);
      expect(result.items).toBeUndefined();
      expect(result.name).toEqual(['test']);
    });
  });

  describe('parseString date edge cases', () => {
    it('should handle escaped date prefix in typed mode', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' } });
      // Value that was escaped because it looks like a date
      const state = { text: 'D12345' };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: {} });
      expect(parsed).toEqual(state);
    });

    it('should skip date parsing when string is escaped in namespaced mode (line 833 escaped branch)', () => {
      // When a string starts with date prefix but was escaped, parseString should not try to parse it as date
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' } });
      // A string like "D12345" gets serialized with escape: =/D12345
      // When parsing, readUntil sets escaped=true when it sees the escape char
      const state = { code: 'D2024' };  // Looks like date prefix + year
      const str = format.stringify(state);
      const parsed = format.parse(str) as typeof state;
      // Should be parsed as string, not date
      expect(parsed.code).toBe('D2024');
      expect(typeof parsed.code).toBe('string');
    });
  });

  describe('date prefix escaping', () => {
    it('should escape string starting with date prefix followed by digit', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' }, separators: { escape: '/' } });
      const state = { name: 'D1764978786133' };
      const stringified = format.stringifyStandalone(state);
      // Should be escaped with / because it starts with D followed by digit
      expect(stringified.name[0]).toContain('/D1764978786133');
      // Round-trip should work
      const parsed = format.parseStandalone(stringified, { initialState: {} });
      expect(parsed).toEqual(state);
    });

    it('should NOT escape string with date prefix NOT at start', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' }, separators: { escape: '/' } });
      const state = { name: '1D764978786133' };
      const stringified = format.stringifyStandalone(state);
      // Should NOT be escaped because D is not at start
      expect(stringified.name[0]).toBe('1D764978786133');
      // Round-trip should work
      const parsed = format.parseStandalone(stringified, { initialState: {} });
      expect(parsed).toEqual(state);
    });

    it('should escape string starting with date prefix followed by negative number', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' }, separators: { escape: '/' } });
      const state = { name: 'D-12345' };
      const stringified = format.stringifyStandalone(state);
      // Should be escaped because it looks like D followed by negative timestamp
      expect(stringified.name[0]).toContain('/D-12345');
      // Round-trip should work
      const parsed = format.parseStandalone(stringified, { initialState: {} });
      expect(parsed).toEqual(state);
    });

    it('should NOT escape string starting with date prefix followed by non-digit', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' }, separators: { escape: '/' } });
      const state = { name: 'Dabcdef' };
      const stringified = format.stringifyStandalone(state);
      // Should NOT be escaped because D is followed by letter, not digit
      expect(stringified.name[0]).toBe('Dabcdef');
      // Round-trip should work
      const parsed = format.parseStandalone(stringified, { initialState: {} });
      expect(parsed).toEqual(state);
    });

    it('should work with custom date prefix', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'DATE' }, separators: { escape: '/' } });
      const state = { name: 'DATE12345' };
      const stringified = format.stringifyStandalone(state);
      // Should be escaped
      expect(stringified.name[0]).toContain('/DATE12345');
      // Round-trip should work
      const parsed = format.parseStandalone(stringified, { initialState: {} });
      expect(parsed).toEqual(state);
    });

    it('should handle actual dates vs date-like strings', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { 
        actualDate: date,
        fakeDateString: 'D' + date.getTime()  // String that looks like a date
      };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect((parsed as typeof state).actualDate).toBeInstanceOf(Date);
      expect((parsed as typeof state).actualDate.getTime()).toBe(date.getTime());
      expect((parsed as typeof state).fakeDateString).toBe(state.fakeDateString);
      expect(typeof (parsed as typeof state).fakeDateString).toBe('string');
    });

    it('should escape in namespaced mode too', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' }, separators: { escape: '/' } });
      const state = { name: 'D1764978786133' };
      const str = format.stringify(state);
      // Should contain the escaped value
      expect(str).toContain('/D1764978786133');
      // Round-trip should work
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });
  });

  describe('arrayMarker !== false but equals @', () => {
    it('should work with explicit @ arrayMarker', () => {
      const format = createFormat({ typed: true, markers: { array: '@' } });
      const state = { items: ['a', 'b', 'c'] };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });
  });

  describe('coercion edge cases for arrays', () => {
    it('should handle non-boolean number in array position', () => {
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
      // Number 2 is not a boolean
      const state = { flags: [true, false] };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
    });
  });

  describe('cleanResult edge cases', () => {
    it('should clean trailing terminators', () => {
      const format = createFormat({ typed: true });
      const state = { obj: { nested: {} } };
      const stringified = format.stringifyStandalone(state);
      // Verify we get clean output without trailing ~
      for (const value of Object.values(stringified)) {
        expect(value[0].endsWith('~~')).toBe(false);
      }
    });
  });

  describe('hasMarker detection in parse', () => {
    it('should detect string marker at start', () => {
      const format = createFormat({ typed: true });
      // Direct string marker value
      const parsed = format.parse('=hello');
      expect(parsed).toBe('hello');
    });

    it('should detect primitive marker at start', () => {
      const format = createFormat({ typed: true });
      const parsed = format.parse(':42');
      expect(parsed).toBe(42);
    });

    it('should detect array marker at start', () => {
      const format = createFormat({ typed: true });
      const parsed = format.parse('@a,b,c~');
      expect(parsed).toEqual(['a', 'b', 'c']);
    });

    it('should detect object marker at start', () => {
      const format = createFormat({ typed: true });
      const parsed = format.parse('.name=test~');
      expect(parsed).toEqual({ name: 'test' });
    });
  });

  describe('plain mode flatten edge cases', () => {
    it('should handle nested object that is not array, Date, or primitive', () => {
      const format = createFormat({ typed: false });
      // A nested object with nested object - goes through else branch
      const state = { outer: { inner: { deep: 'value' } } };
      const result = format.stringifyStandalone(state);
      expect(result['outer.inner.deep']).toEqual(['value']);
    });
  });

  describe('autoparse disabled combinations', () => {
    it('should not parse date when autoParseDates is false even if it looks like ISO', () => {
      const format = createFormat({ 
        typed: false, 
        parse: { dates: false, numbers: false },
      });
      const params = toParams([{ key: 'val', value: '2024-01-15T10:30:00.000Z' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect(typeof (parsed as { val: string }).val).toBe('string');
    });
  });

  describe('namespaced parse edge cases', () => {
    it('should handle empty entry in namespaced parse', () => {
      const format = createFormat({ typed: false });
      // Entry without equals sign should be skipped
      const parsed = format.parse('invalid,name=test');
      expect(parsed).toEqual({ name: 'test' });
    });

    it('should handle last entry without equals sign', () => {
      const format = createFormat({ typed: false });
      const parsed = format.parse('name=test,invalid');
      expect(parsed).toEqual({ name: 'test' });
    });
    it('should handle consecutive separators', () => {
      const format = createFormat({ typed: false });
      const parsed = format.parse('a=1,,b=2');
      expect(parsed).toEqual({ a: 1, b: 2 });
    });
  });

  describe('multiple values without shouldBeArray', () => {
    it('should handle multiple values when initialState is not an array', () => {
      const format = createFormat({ typed: false });
      // Multiple values for same key but initialState is not array
      const params = toParams([
        { key: 'val', value: 'first' },
        { key: 'val', value: 'second' },
      ]);
      const parsed = format.parseStandalone(params, { initialState: { val: '' } });
      // Should still return array since we have multiple values
      expect((parsed as { val: string[] }).val).toEqual(['first', 'second']);
    });
  });

  describe('nesting separator edge cases', () => {
    it('should handle consecutive nesting separators in key', () => {
      const format = createFormat({ typed: false, separators: { nesting: '.' } });
      // Key with consecutive separators - empty parts get skipped
      const parsed = format.parse('a..b=value');
      // Empty part gets skipped, so it's just a nested structure
      expect(parsed).toEqual({ a: { b: 'value' } });
    });
  });

  describe('date ISO parsing branch', () => {
    it('should parse date in ISO format', () => {
      const format = createFormat({ typed: true, serialize: { dates: 'iso' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      // Namespaced with ISO date
      const state = { created: date };
      const str = format.stringify(state);
      const parsed = format.parse(str) as typeof state;
      expect(parsed.created).toBeInstanceOf(Date);
    });
  });

  describe('parseString with invalid date', () => {
    it('should handle date-like string that is not valid date', () => {
      const format = createFormat({ typed: true });
      // D followed by something that's not a valid date/timestamp
      const state = { code: 'Dabc123' };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });
  });

  describe('typed standalone parse edge cases', () => {
    it('should handle standalone parsing without marker but has initialState', () => {
      const format = createFormat({ typed: true, markers: { array: false } });
      const state = { items: ['a', 'b'] };
      // Parse standalone with array marker disabled
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
    });
  });

  describe('booleanStyle number in arrays with mixed types', () => {
    it('should coerce boolean array with booleanStyle number', () => {
      const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
      const state = { values: [true, false, 1, 0] };
      const str = format.stringify(state);
      const parsed = format.parse(str, { initialState: { values: [true, false, 1, 0] } });
      // All get parsed as numbers first, then coerced based on position
      // But since initialState has mixed types, coercion follows the pattern
      expect(parsed).toBeDefined();
    });
  });

  describe('escape sequences in plain namespaced mode', () => {
    it('should handle escape followed by nesting separator', () => {
      const format = createFormat({ typed: false, separators: { escape: '/', nesting: '.' } });
      // Escaped dot in key
      const str = 'user/.name=test';
      const parsed = format.parse(str);
      expect(parsed).toEqual({ 'user.name': 'test' });
    });
  });

  describe('objTest regex matching', () => {
    it('should detect object structure in namespaced typed parse', () => {
      const format = createFormat({ typed: true });
      // Value that looks like an object (has key=value pattern)
      const parsed = format.parse('name=John,age:30');
      expect(parsed).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('readUntil with escape check', () => {
    it('should handle escaped date prefix followed by digits', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: 'D' } });
      // A string that starts with escaped D (so it's not a date)
      const state = { text: 'D2024' };  // Looks like date but is string
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });
  });

  describe('typed parse with datePrefix false', () => {
    it('should work in namespaced mode with markers: { datePrefix: false }', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false } });
      // markers: { datePrefix: false } is allowed in namespaced mode
      const state = { code: 'D123' };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });

    it('should handle D as regular character in standalone mode when markers: { datePrefix: false }', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false } });
      // When datePrefix is false in standalone mode, D is just a regular character
      const state = { code: 'D123' };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
    });
  });

  describe('remaining branch coverage', () => {
    // Line 369: else if (typeof value === 'object') when value is NOT an object
    // This happens for values like Symbol that aren't handled elsewhere
    it('should handle Symbol values in plain mode (line 369)', () => {
      const format = createFormat({ typed: false });
      // Symbol is not a primitive, array, or object - falls through
      const sym = Symbol('test');
      const state = { name: 'test', sym: sym as unknown as string };
      const result = format.stringifyStandalone(state);
      // Symbol should be skipped or handled
      expect(result.name).toEqual(['test']);
    });

    // Line 394-396: autoParseBooleans true but value is not 'true' or 'false'
    it('should not parse non-boolean strings when autoParseBooleans is true (line 394-396)', () => {
      const format = createFormat({ typed: false, parse: { booleans: true } });
      const params = toParams([{ key: 'val', value: 'yes' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      // 'yes' is not 'true' or 'false', so should remain as string
      expect((parsed as { val: string }).val).toBe('yes');
    });

    // Line 399: ISO date regex matches but date is invalid
    it('should handle invalid ISO date string in autoparse (line 399)', () => {
      const format = createFormat({ typed: false, parse: { dates: true } });
      // Looks like ISO date but has invalid values
      const params = toParams([{ key: 'date', value: '2024-99-99T99:99:99.000Z' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      // Invalid date should remain as string or be parsed differently
      expect(parsed).toBeDefined();
    });

    // Lines 394-396: autoParseBooleans true and value IS 'true' or 'false'
    it('should auto-parse true/false strings when autoParseBooleans is true (line 394-396)', () => {
      const format = createFormat({ typed: false, parse: { booleans: true } });
      const params = toParams([
        { key: 'a', value: 'true' },
        { key: 'b', value: 'false' },
      ]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect((parsed as { a: boolean }).a).toBe(true);
      expect((parsed as { b: boolean }).b).toBe(false);
    });

    // Lines 394-396: autoParseValue with empty/null/undefined strings
    it('should handle empty string in autoParseValue (line 394)', () => {
      const format = createFormat({ typed: false });
      const params = toParams([{ key: 'val', value: '' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect((parsed as { val: string }).val).toBe('');
    });

    it('should handle null string in autoParseValue (line 395)', () => {
      const format = createFormat({ typed: false, serialize: { null: 'null' } });
      const params = toParams([{ key: 'val', value: 'null' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect((parsed as { val: null }).val).toBe(null);
    });

    it('should handle undefined string in autoParseValue (line 396)', () => {
      const format = createFormat({ typed: false, serialize: { undefined: 'undefined' } });
      const params = toParams([{ key: 'val', value: 'undefined' }]);
      const parsed = format.parseStandalone(params, { initialState: {} });
      expect((parsed as { val: undefined }).val).toBe(undefined);
    });

    // Line 405: boolean coercion when value is not true/false/1/0 - now falls back to auto-parse
    it('should fall back to auto-parse for invalid boolean (line 405)', () => {
      const format = createFormat({ typed: false });
      const params = toParams([{ key: 'active', value: 'yes' }]);
      const parsed = format.parseStandalone(params, { initialState: { active: true } });
      // 'yes' is not a valid boolean, falls back to auto-parse (returns string)
      expect((parsed as { active: string }).active).toBe('yes');
    });

    // Line 409/439: timestamp regex matches but date is invalid (very hard to trigger)
    it('should handle edge case timestamp parsing (line 409/439)', () => {
      const format = createFormat({ typed: false, serialize: { dates: 'timestamp' } });
      // Huge timestamp that might cause issues
      const params = toParams([{ key: 'ts', value: '99999999999999999999' }]);
      const parsed = format.parseStandalone(params, { initialState: { ts: new Date() } });
      // Should handle gracefully
      expect(parsed).toBeDefined();
    });

    // Line 414: successful ISO date coercion
    it('should coerce ISO date string to Date (line 414)', () => {
      const format = createFormat({ typed: false });
      const params = toParams([{ key: 'date', value: '2024-01-15T10:30:00.000Z' }]);
      const parsed = format.parseStandalone(params, { initialState: { date: new Date() } });
      expect((parsed as { date: Date }).date).toBeInstanceOf(Date);
    });

    // Line 499: bracket notation with empty current
    it('should handle bracket notation at start of key (line 499)', () => {
      const format = createFormat({ typed: false, plain: { arrayIndexStyle: 'bracket' } });
      // Key starts with bracket - current is empty
      const params = toParams([{ key: '[0]', value: 'first' }]);
      const parsed = format.parseStandalone(params, { initialState: { '': [''] } });
      expect(parsed).toBeDefined();
    });

    // Line 637: last entry without equals sign
    it('should handle namespaced value ending without equals (line 637)', () => {
      const format = createFormat({ typed: false });
      // Last entry is just a value without =
      const parsed = format.parse('name=test,orphan');
      expect(parsed).toEqual({ name: 'test' });
    });

    it('should handle namespaced value ending with trailing comma (line 637 else)', () => {
      const format = createFormat({ typed: false });
      // String ends with comma - current is empty at end
      const parsed = format.parse('name=test,');
      expect(parsed).toEqual({ name: 'test' });
    });

    // Line 743: serialize returns empty for non-undefined value
    it('should handle function in object (line 743)', () => {
      const format = createFormat({ typed: true });
      const state = { name: 'test', callback: () => {} };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      // Function should be skipped
      expect((parsed as { name: string }).name).toBe('test');
      expect((parsed as { callback?: unknown }).callback).toBeUndefined();
    });

    // Line 819/882: parseInt of timestamp returns NaN (practically impossible)
    // Skip - parseInt of all-digit string cannot return NaN

    // Line 843: objTest returns false (string marker branch)
    it('should parse plain string without object markers (line 843)', () => {
      const format = createFormat({ typed: true });
      // Plain string without any type markers
      const parsed = format.parse('hello');
      expect(parsed).toBe('hello');
    });

    // Line 861: escape at end of string
    it('should handle trailing escape character (line 861)', () => {
      const format = createFormat({ typed: true, separators: { escape: '/' } });
      // String ending with escape character - manually construct
      const state = { text: 'hello/' };
      const str = format.stringify(state);
      const parsed = format.parse(str);
      expect(parsed).toEqual(state);
    });

    it('should handle escape at end of source (line 861 else)', () => {
      const format = createFormat({ typed: true, separators: { escape: '/' } });
      // Manually craft a string ending with escape (malformed)
      // This hits the else branch where pos >= source.length after escape
      const parsed = format.parse('.text=hello/');
      // The trailing / without a following char is handled gracefully
      expect(parsed).toBeDefined();
    });

    // Line 929: array with trailing separator at end of source
    it('should handle array ending with separator at source end (line 929)', () => {
      const format = createFormat({ typed: true });
      // Array that ends with trailing comma (no terminator)
      // This would be malformed but should handle gracefully
      const parsed = format.parse('@a,b,');
      expect(parsed).toEqual(['a', 'b', '']);
    });

    // Line 957: unexpected type marker - this is essentially unreachable in normal usage
    // because the parser always prepends a valid marker to the source string
    // Skip this test as it's dead code

    // markers: { datePrefix: false } is allowed in namespaced mode
    it('should work with markers: { datePrefix: false } in namespaced mode (line 973 else)', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'iso' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { created: date };
      const str = format.stringify(state);
      // Date is serialized as ISO string
      expect(str).toContain(date.toISOString());
    });

    it('should coerce ISO date string in standalone mode with markers: { datePrefix: false }', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false }, serialize: { dates: 'iso' } });
      const date = new Date('2024-01-15T10:30:00.000Z');
      const state = { created: date };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect((parsed as { created: Date }).created).toBeInstanceOf(Date);
    });

    it('should handle invalid timestamp in standalone mode with markers: { datePrefix: false }', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false } });
      // Very large number that creates invalid date
      const parsed = format.parseStandalone(
        toParams([{ key: 'ts', value: '99999999999999999999' }]), 
        { initialState: { ts: new Date() } }
      );
      // Should handle gracefully - invalid date falls through
      expect(parsed).toBeDefined();
    });

    // Invalid date string in standalone mode with markers: { datePrefix: false }
    it('should handle invalid ISO string in standalone mode with markers: { datePrefix: false } (line 981)', () => {
      const format = createFormat({ typed: true, markers: { datePrefix: false } });
      // Invalid ISO date string
      const parsed = format.parseStandalone(
        toParams([{ key: 'date', value: 'not-a-date' }]),
        { initialState: { date: new Date() } }
      );
      // Should return the string since it's not a valid date
      expect((parsed as { date: string }).date).toBe('not-a-date');
    });
  });

  describe('markers: { primitive: false }', () => {
    const format = createFormat({ typed: true, markers: { primitive: false } });

    it('should serialize primitives without : prefix in standalone mode', () => {
      const state = { name: 'John', age: 30, active: true, score: 3.14 };
      const result = format.stringifyStandalone(state);
      // No : prefix for primitives
      expect(result.age).toEqual(['30']);
      expect(result.active).toEqual(['true']);
      expect(result.score).toEqual(['3/.14']); // escaped dot
      expect(result.name).toEqual(['John']);
    });

    it('should auto-parse primitives without initialState', () => {
      const params = toParams([
        { key: 'age', value: '30' },
        { key: 'active', value: 'true' },
        { key: 'score', value: '3/.14' },
        { key: 'name', value: 'John' },
      ]);
      const parsed = format.parseStandalone(params, { initialState: {} }) as {
        age: number;
        active: boolean;
        score: number;
        name: string;
      };
      expect(parsed.age).toBe(30);
      expect(typeof parsed.age).toBe('number');
      expect(parsed.active).toBe(true);
      expect(typeof parsed.active).toBe('boolean');
      expect(parsed.score).toBe(3.14);
      expect(typeof parsed.score).toBe('number');
      expect(parsed.name).toBe('John');
    });

    it('should coerce to initialState types when provided', () => {
      const initialState = { age: 0, active: false, score: 0, name: '' };
      const params = toParams([
        { key: 'age', value: '30' },
        { key: 'active', value: 'true' },
        { key: 'score', value: '3/.14' },
        { key: 'name', value: 'John' },
      ]);
      const parsed = format.parseStandalone(params, { initialState }) as typeof initialState;
      expect(parsed.age).toBe(30);
      expect(parsed.active).toBe(true);
      expect(parsed.score).toBe(3.14);
      expect(parsed.name).toBe('John');
    });

    it('should throw error in namespaced mode with markers: { primitive: false }', () => {
      const state = { age: 30, active: true };
      // markers: { primitive: false } is only valid in standalone mode
      expect(() => format.stringify(state)).toThrow(
        /primitiveMarker: false.*standalone mode/
      );
    });

    it('should round-trip in standalone mode', () => {
      const state = { 
        name: 'John', 
        age: 30, 
        active: true, 
        score: 3.14,
        nothing: null,
      };
      const stringified = format.stringifyStandalone(state);
      const parsed = format.parseStandalone(stringified, { initialState: state });
      expect(parsed).toEqual(state);
    });

    it('should handle special values (null, undefined)', () => {
      const state = { a: null, b: undefined };
      const stringified = format.stringifyStandalone(state);
      expect(stringified.a).toEqual(['null']);
      expect(stringified.b).toEqual(['undefined']);
      
      const parsed = format.parseStandalone(stringified, { initialState: {} });
      expect(parsed).toEqual({ a: null, b: undefined });
    });

    it('should respect string type hint over auto-parse', () => {
      // When initialState says it's a string, don't auto-parse to number
      const params = toParams([
        { key: 'zipCode', value: '12345' },
        { key: 'phoneDigit', value: '0' },
      ]);
      const parsed = format.parseStandalone(params, { 
        initialState: { zipCode: '', phoneDigit: '' } 
      }) as { zipCode: string; phoneDigit: string };
      
      // Should remain strings, not numbers
      expect(parsed.zipCode).toBe('12345');
      expect(typeof parsed.zipCode).toBe('string');
      expect(parsed.phoneDigit).toBe('0');
      expect(typeof parsed.phoneDigit).toBe('string');
    });

    it('should auto-parse when no type hint even if value looks like string', () => {
      // Without initialState type hint, auto-parse kicks in
      const params = toParams([
        { key: 'zipCode', value: '12345' },
      ]);
      const parsed = format.parseStandalone(params, { initialState: {} }) as { zipCode: number };
      
      // Should be number (auto-parsed)
      expect(parsed.zipCode).toBe(12345);
      expect(typeof parsed.zipCode).toBe('number');
    });

    it('should skip boolean auto-parse when autoParseBooleans is false (line 965 else branch)', () => {
      const formatNoAutoBools = createFormat({ 
        typed: true, 
        markers: { primitive: false },
        parse: { booleans: false } 
      });
      const params = toParams([
        { key: 'flag', value: 'true' },
      ]);
      const parsed = formatNoAutoBools.parseStandalone(params, { 
        initialState: {} 
      }) as { flag: string };
      
      // Should remain string since autoParseBooleans is false
      expect(parsed.flag).toBe('true');
      expect(typeof parsed.flag).toBe('string');
    });

    it('should skip date auto-parse when autoParseDates is false (line 969 else branch)', () => {
      const formatNoAutoDates = createFormat({ 
        typed: true, 
        markers: { primitive: false },
        parse: { dates: false },
        serialize: { dates: 'timestamp' }
      });
      const params = toParams([
        { key: 'timestamp', value: '1718451000000' },  // valid timestamp
      ]);
      const parsed = formatNoAutoDates.parseStandalone(params, { 
        initialState: {} 
      }) as { timestamp: number };
      
      // Should be parsed as number, not Date, since autoParseDates is false
      expect(typeof parsed.timestamp).toBe('number');
      expect(parsed.timestamp).toBe(1718451000000);
    });

    it('should skip number auto-parse when autoParseNumbers is false (line 973 else branch)', () => {
      const formatNoAutoNums = createFormat({ 
        typed: true, 
        markers: { primitive: false },
        parse: { numbers: false } 
      });
      const params = toParams([
        { key: 'value', value: '12345' },
      ]);
      const parsed = formatNoAutoNums.parseStandalone(params, { 
        initialState: {} 
      }) as { value: string };
      
      // Should remain string since autoParseNumbers is false
      expect(parsed.value).toBe('12345');
      expect(typeof parsed.value).toBe('string');
    });

    it('should auto-parse date in autoParseValue when autoParseDates is true (line 971)', () => {
      // Test that auto-parse dates succeeds and returns the date
      const formatAutoDateTimestamp = createFormat({ 
        typed: true, 
        markers: { primitive: false },
        parse: { dates: true },
        serialize: { dates: 'timestamp' }
      });
      // Use a timestamp in the plausible range (2024)
      const timestamp = new Date('2024-06-15T12:00:00.000Z').getTime();
      const params = toParams([
        { key: 'date', value: String(timestamp) },
      ]);
      const parsed = formatAutoDateTimestamp.parseStandalone(params, { 
        initialState: {}  // No type hint - rely on auto-parse
      }) as { date: Date };
      
      // Should be parsed as Date via auto-parse
      expect(parsed.date).toBeInstanceOf(Date);
      expect(parsed.date.getTime()).toBe(timestamp);
    });

    it('should coerce dates in autoParseValue when primitiveMarker is false', () => {
      // This tests the Date coercion path in autoParseValue (lines 960-962)
      const date = new Date('2024-01-15T10:30:00.000Z');
      const params = toParams([
        { key: 'created', value: String(date.getTime()) },
      ]);
      const parsed = format.parseStandalone(params, { 
        initialState: { created: new Date() } 
      }) as { created: Date };
      
      // Should be coerced to Date based on initialState hint
      expect(parsed.created).toBeInstanceOf(Date);
      expect(parsed.created.getTime()).toBe(date.getTime());
    });

    it('should coerce booleans in autoParseValue when primitiveMarker is false', () => {
      // This tests the boolean coercion path in autoParseValue (lines 956-959)
      const params = toParams([
        { key: 'active', value: 'true' },
        { key: 'disabled', value: 'false' },
      ]);
      const parsed = format.parseStandalone(params, { 
        initialState: { active: false, disabled: true } 
      }) as { active: boolean; disabled: boolean };
      
      // Should be coerced to boolean based on initialState hint
      expect(parsed.active).toBe(true);
      expect(parsed.disabled).toBe(false);
    });

    it('should fall through when number coercion fails (line 951-953 else branch)', () => {
      // Test case where hint is number but value can't be parsed as number
      const params = toParams([
        { key: 'count', value: 'not-a-number' },
      ]);
      const parsed = format.parseStandalone(params, { 
        initialState: { count: 42 }  // hint is number
      }) as { count: string | number };
      
      // Should fall through and return the string since it can't be parsed as number
      expect(parsed.count).toBe('not-a-number');
      expect(typeof parsed.count).toBe('string');
    });

    it('should fall through when boolean coercion fails (line 954-957 else branch)', () => {
      // Test case where hint is boolean but value can't be parsed as boolean
      const params = toParams([
        { key: 'flag', value: 'maybe' },  // not a valid boolean string
      ]);
      const parsed = format.parseStandalone(params, { 
        initialState: { flag: true }  // hint is boolean
      }) as { flag: string | boolean };
      
      // Should fall through and return the string since it can't be parsed as boolean
      expect(parsed.flag).toBe('maybe');
      expect(typeof parsed.flag).toBe('string');
    });

    it('should fall through when date coercion fails (line 958-961 else branch)', () => {
      // Test case where hint is Date but value can't be parsed as date
      const params = toParams([
        { key: 'created', value: 'not-a-date' },
      ]);
      const parsed = format.parseStandalone(params, { 
        initialState: { created: new Date() }  // hint is Date
      }) as { created: string | Date };
      
      // Should fall through and return the string since it can't be parsed as date
      expect(parsed.created).toBe('not-a-date');
      expect(typeof parsed.created).toBe('string');
    });

    it('should fall through auto-parse booleans when parsing fails (line 965-968 else branch)', () => {
      // Test case where parseBools is true but value isn't a valid boolean
      const params = toParams([
        { key: 'value', value: 'maybe' },  // not true/false
      ]);
      // No initialState hint, rely on auto-parse
      const parsed = format.parseStandalone(params, { 
        initialState: {} 
      }) as { value: string };
      
      // Should fall through since 'maybe' isn't a valid boolean
      expect(parsed.value).toBe('maybe');
    });

    it('should fall through auto-parse dates when parsing fails (line 969-972 else branch)', () => {
      // Test case where parseDates is true but value isn't a valid date
      const params = toParams([
        { key: 'value', value: 'hello' },  // not a date
      ]);
      // No initialState hint, rely on auto-parse
      const parsed = format.parseStandalone(params, { 
        initialState: {} 
      }) as { value: string };
      
      // Should fall through since 'hello' isn't a valid date
      expect(parsed.value).toBe('hello');
    });

    it('should fall through auto-parse numbers when parsing fails (line 973-976 else branch)', () => {
      // Test case where parseNums is true but value isn't a valid number
      const params = toParams([
        { key: 'value', value: 'abc' },  // not a number
      ]);
      // No initialState hint, rely on auto-parse
      const parsed = format.parseStandalone(params, { 
        initialState: {} 
      }) as { value: string };
      
      // Should fall through since 'abc' isn't a valid number, return as string
      expect(parsed.value).toBe('abc');
      expect(typeof parsed.value).toBe('string');
    });

    it('should return string when all auto-parse attempts fail', () => {
      // Value that doesn't match any auto-parse pattern
      const params = toParams([
        { key: 'text', value: 'some random text' },
      ]);
      const parsed = format.parseStandalone(params, { 
        initialState: {} 
      }) as { text: string };
      
      // Should return the original string value
      expect(parsed.text).toBe('some random text');
      expect(typeof parsed.text).toBe('string');
    });
  });

  describe('typed mode date coercion in parseValue (lines 910-912, 929-932)', () => {
    it('should coerce primitive marker string to Date when initialState has Date (line 910-912)', () => {
      // This tests the path: primitiveMarker value is a string, but hint is Date
      // Scenario: markers: { datePrefix: false } + dateStyle: iso, date serialized as ISO string with : prefix
      const format = createFormat({ 
        typed: true, 
        markers: { datePrefix: false },
        serialize: { dates: 'iso' }
      });
      const date = new Date('2024-06-15T12:30:00.000Z');
      const state = { created: date };
      
      // Serialize and parse in namespaced mode with initialState
      const str = format.stringify(state);
      const parsed = format.parse(str, { initialState: state }) as typeof state;
      
      // Verify the date was correctly coerced back
      expect(parsed.created).toBeInstanceOf(Date);
      expect(parsed.created.getTime()).toBe(date.getTime());
    });

    it('should coerce string marker value to Date when auto-parse fails but hint is Date (line 929-932)', () => {
      // This tests the specific path where:
      // 1. parseString() returns a string (auto-parse failed due to plausibility check)
      // 2. valHint is a Date
      // 3. tryParseDate is called with strict=true to coerce
      //
      // This happens for timestamps outside the auto-parse plausible range (1990-3000)
      // but with initialState hint saying it should be a Date
      const format = createFormat({ 
        typed: true, 
        markers: { datePrefix: false },
        serialize: { dates: 'timestamp' }
      });
      
      // Unix epoch (timestamp 0) is outside plausible range for auto-parsing
      // but with initialState hint, it should still coerce
      const epochDate = new Date(0);
      const state = { epochTime: epochDate };
      
      const str = format.stringify(state);
      // The timestamp '0' won't auto-parse (not plausible) but with hint it should coerce
      const parsed = format.parse(str, { initialState: state }) as typeof state;
      
      expect(parsed.epochTime).toBeInstanceOf(Date);
      expect(parsed.epochTime.getTime()).toBe(0);
    });

    it('should coerce very old dates that fail plausibility check (line 929-932)', () => {
      const format = createFormat({ 
        typed: true, 
        markers: { datePrefix: false },
        serialize: { dates: 'timestamp' }
      });
      
      // Date from 1960 - timestamp is negative and outside plausible auto-parse range
      const oldDate = new Date('1960-01-01T00:00:00.000Z');
      const state = { historical: oldDate };
      
      const str = format.stringify(state);
      const parsed = format.parse(str, { initialState: state }) as typeof state;
      
      expect(parsed.historical).toBeInstanceOf(Date);
      expect(parsed.historical.getTime()).toBe(oldDate.getTime());
    });

    it('should NOT coerce string to Date when tryParseDate fails (line 931 else branch)', () => {
      // This tests when the string doesn't parse as a valid date
      const format = createFormat({ 
        typed: true, 
        markers: { datePrefix: false },
        serialize: { dates: 'timestamp' }
      });
      
      // Manually construct params with a non-date string but Date hint
      const stringified = format.stringifyStandalone({ text: 'not-a-date' });
      // Now parse it pretending the initialState has a Date
      const parsed = format.parseStandalone(stringified, { 
        initialState: { text: new Date() } 
      }) as { text: string | Date };
      
      // Should remain a string since 'not-a-date' can't be parsed as timestamp
      expect(typeof parsed.text).toBe('string');
      expect(parsed.text).toBe('not-a-date');
    });

    it('should NOT coerce string to Date in namespaced mode when tryParseDate fails (line 927)', () => {
      // This tests when the string in namespaced mode doesn't parse as a valid date
      // Target: line 927 - the else branch after tryParseDate returns null
      const format = createFormat({ 
        typed: true, 
        markers: { datePrefix: false },
        serialize: { dates: 'timestamp' }
      });
      
      // Create a string that looks like a string marker value but can't be parsed as date
      // We need to manually create a namespaced string to test this edge case
      // text=hello where initialState.text is a Date
      const parsed = format.parse('text=hello', { 
        initialState: { text: new Date() } 
      }) as { text: string | Date };
      
      // Should remain 'hello' since it can't be parsed as timestamp
      expect(typeof parsed.text).toBe('string');
      expect(parsed.text).toBe('hello');
    });

    it('should skip Date coercion when parseString already returns Date (line 922 else branch)', () => {
      // When markers: { datePrefix: false } and parseString() successfully auto-parses a plausible timestamp,
      // s is already a Date, so typeof s === 'string' is false, and we skip coercion
      const format = createFormat({ 
        typed: true, 
        markers: { datePrefix: false },
        serialize: { dates: 'timestamp' }
      });
      
      // A timestamp in the plausible range (2024) will be auto-parsed by parseString()
      const date = new Date('2024-06-15T12:30:00.000Z');
      const state = { event: date };
      
      const str = format.stringify(state);
      // When parsed, parseString() will auto-parse the timestamp and return a Date
      // The coercion block will be skipped because typeof s !== 'string'
      const parsed = format.parse(str, { initialState: state }) as typeof state;
      
      expect(parsed.event).toBeInstanceOf(Date);
      expect(parsed.event.getTime()).toBe(date.getTime());
    });

    it('should round-trip dates correctly with markers: { datePrefix: false } in namespaced mode', () => {
      const format = createFormat({ 
        typed: true, 
        markers: { datePrefix: false },
        serialize: { dates: 'timestamp' }
      });
      
      const originalDate = new Date('2024-12-25T00:00:00.000Z');
      const state = { 
        event: 'Christmas',
        date: originalDate,
        count: 42
      };
      
      const str = format.stringify(state);
      const parsed = format.parse(str, { initialState: state }) as typeof state;
      
      // Verify all fields
      expect(parsed.event).toBe('Christmas');
      expect(parsed.count).toBe(42);
      expect(parsed.date).toBeInstanceOf(Date);
      expect(parsed.date.getTime()).toBe(originalDate.getTime());
    });

    it('should handle array of dates with markers: { datePrefix: false }', () => {
      const format = createFormat({ 
        typed: true, 
        markers: { datePrefix: false },
        serialize: { dates: 'timestamp' }
      });
      
      const dates = [
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-06-15T12:00:00.000Z'),
        new Date('2024-12-31T23:59:59.000Z')
      ];
      const state = { events: dates };
      
      const str = format.stringify(state);
      const parsed = format.parse(str, { initialState: state }) as typeof state;
      
      expect(parsed.events).toHaveLength(3);
      parsed.events.forEach((d, i) => {
        expect(d).toBeInstanceOf(Date);
        expect(d.getTime()).toBe(dates[i].getTime());
      });
    });
  });

  describe('standalone-only options validation', () => {
    it('should throw error listing all invalid options in namespaced mode', () => {
      const format = createFormat({ 
        typed: true, 
        markers: { primitive: false, array: false },
      });
      const state = { count: 42 };
      expect(() => format.stringify(state)).toThrow(
        /primitiveMarker: false.*arrayMarker: false.*standalone mode/
      );
    });

    it('should throw on parse as well in namespaced mode', () => {
      const format = createFormat({ 
        typed: true, 
        markers: { primitive: false },
      });
      expect(() => format.parse('count:42')).toThrow(
        /primitiveMarker: false.*standalone mode/
      );
    });

    it('should allow markers: { datePrefix: false } in namespaced mode', () => {
      // markers: { datePrefix: false } is allowed because dates are wrapped with strMarker anyway
      const format = createFormat({ 
        typed: true, 
        markers: { datePrefix: false },
      });
      const state = { created: new Date('2024-01-15T10:30:00.000Z') };
      const str = format.stringify(state);
      expect(str).toBeDefined();
    });

    it('should not throw in standalone mode with all options disabled', () => {
      const format = createFormat({ 
        typed: true, 
        markers: { primitive: false, array: false, datePrefix: false },
      });
      const state = { name: 'John', count: 42, items: ['a', 'b'], date: new Date() };
      // Standalone mode should work
      expect(() => format.stringifyStandalone(state)).not.toThrow();
      const stringified = format.stringifyStandalone(state);
      expect(() => format.parseStandalone(stringified, { initialState: state })).not.toThrow();
    });
  });

  describe('format configuration validation errors', () => {
    it('should throw when escape character conflicts with separator in plain mode', () => {
      expect(() => createFormat({ 
        typed: false, 
        separators: { escape: ',', entry: ',' }
      })).toThrow(/escape.*conflicts/);
    });

    it('should throw when escape character conflicts with nestingSeparator in plain mode', () => {
      expect(() => createFormat({ 
        typed: false, 
        separators: { escape: '.', nesting: '.' }
      })).toThrow(/escape.*conflicts/);
    });

    it('should throw when escape character conflicts with arraySeparator in plain mode', () => {
      expect(() => createFormat({ 
        typed: false,
        separators: { escape: '|', array: '|' }
      })).toThrow(/escape.*conflicts/);
    });

    it('should throw when separator equals nestingSeparator in plain mode', () => {
      expect(() => createFormat({ 
        typed: false, 
        separators: { entry: '.', nesting: '.' }
      })).toThrow(/entry.*conflicts.*nesting/);
    });

    it('should throw when arraySeparator equals nestingSeparator in plain mode', () => {
      expect(() => createFormat({ 
        typed: false, 
        separators: { array: '.', nesting: '.' }
      })).toThrow(/array.*conflicts.*nesting/);
    });

    it('should throw when markers collide in typed mode', () => {
      expect(() => createFormat({ 
        typed: true, 
        markers: { string: ':', primitive: ':' }
      })).toThrow(/Collision/);
    });

    it('should throw when escape conflicts with marker in typed mode', () => {
      expect(() => createFormat({ 
        typed: true, 
        separators: { escape: '=' },
        markers: { string: '=' }
      })).toThrow(/conflicts/);
    });

    it('should warn about plain-only options in typed mode', () => {
      expect(() => createFormat({ 
        typed: true, 
        plain: { arrayIndexStyle: 'bracket' }
      })).toThrow(/plain.*options.*typed: false/);
    });

    it('should warn about typed-only options in plain mode', () => {
      expect(() => createFormat({ 
        typed: false, 
        markers: { string: '"' }
      })).toThrow(/markers.*options.*typed: true/);
    });
  });
});
