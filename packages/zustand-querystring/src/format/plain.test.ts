import { describe, it, expect } from 'vitest';
import { plain, createFormat } from './plain';

describe('plain format', () => {
  describe('stringify (namespaced mode)', () => {
    it('should stringify simple object', () => {
      const result = plain.stringify({ name: 'John', age: 30 });
      expect(result).toContain('name=John');
      expect(result).toContain('age=30');
      expect(result).toContain(',');
    });

    it('should stringify nested objects with dot notation', () => {
      const result = plain.stringify({
        user: { name: 'John', email: 'john@example.com' },
      });
      expect(result).toContain('user.name=John');
      expect(result).toContain('user.email=john%40example.com');
    });

    it('should stringify deeply nested objects', () => {
      const result = plain.stringify({ a: { b: { c: { d: 'deep' } } } });
      expect(result).toBe('a.b.c.d=deep');
    });

    it('should stringify simple arrays with repeated keys', () => {
      const result = plain.stringify({ tags: ['a', 'b', 'c'] });
      expect(result).toBe('tags=a,tags=b,tags=c');
    });

    it('should stringify empty arrays', () => {
      const result = plain.stringify({ items: [] });
      expect(result).toBe('items=');
    });

    it('should stringify null values', () => {
      const result = plain.stringify({ value: null });
      expect(result).toBe('value=null');
    });

    it('should stringify undefined values', () => {
      const result = plain.stringify({ value: undefined });
      expect(result).toBe('value=undefined');
    });

    it('should stringify dates as ISO strings', () => {
      const date = new Date('2024-01-15T12:00:00.000Z');
      const result = plain.stringify({ created: date });
      expect(result).toBe('created=2024-01-15T12%3A00%3A00.000Z');
    });

    it('should stringify booleans', () => {
      const result = plain.stringify({ enabled: true, disabled: false });
      expect(result).toContain('enabled=true');
      expect(result).toContain('disabled=false');
    });

    it('should escape dots in keys', () => {
      const result = plain.stringify({ 'my.key': 'value' });
      expect(result).toBe('my_.key=value');
    });

    it('should escape commas in values', () => {
      const result = plain.stringify({ text: 'a,b,c' });
      expect(result).toBe('text=a_,b_,c');
    });

    it('should escape escape character only when needed', () => {
      // Underscores don't need escaping - only special chars like , do
      // Input: a_,b -> only , needs escape -> a__,b  (the _ before , is just kept)
      const result = plain.stringify({ path: 'a_,b' });
      expect(result).toBe('path=a__,b');
    });

    it('should stringify objects in arrays with indexed notation', () => {
      const result = plain.stringify({ items: [{ id: 1 }, { id: 2 }] });
      expect(result).toBe('items.0.id=1,items.1.id=2');
    });

    it('should stringify mixed arrays (with objects) using indexed notation', () => {
      const result = plain.stringify({ items: [{ x: 1 }, 'plain', { y: 2 }] });
      expect(result).toContain('items.0.x=1');
      expect(result).toContain('items.1=plain');
      expect(result).toContain('items.2.y=2');
    });
  });

  describe('parse (namespaced mode)', () => {
    it('should parse simple values', () => {
      const result = plain.parse('name=John,age=30', {
        initialState: { name: '', age: 0 },
      });
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should parse nested objects from dot notation', () => {
      const result = plain.parse('user.name=John,user.age=30', {
        initialState: { user: { name: '', age: 0 } },
      });
      expect(result).toEqual({ user: { name: 'John', age: 30 } });
    });

    it('should parse arrays from repeated keys', () => {
      const result = plain.parse('tags=a,tags=b,tags=c', {
        initialState: { tags: [''] },
      });
      expect(result).toEqual({ tags: ['a', 'b', 'c'] });
    });

    it('should parse empty arrays', () => {
      const result = plain.parse('items=', {
        initialState: { items: [] },
      });
      expect(result).toEqual({ items: [] });
    });

    it('should infer number type from initialState', () => {
      const result = plain.parse('count=42', { initialState: { count: 0 } });
      expect(result).toEqual({ count: 42 });
      expect(typeof (result as any).count).toBe('number');
    });

    it('should infer boolean type from initialState', () => {
      const result = plain.parse('enabled=true', {
        initialState: { enabled: false },
      });
      expect(result).toEqual({ enabled: true });
      expect(typeof (result as any).enabled).toBe('boolean');
    });

    it('should infer Date type from initialState', () => {
      const result = plain.parse('created=2024-01-15T12:00:00.000Z', {
        initialState: { created: new Date() },
      });
      expect((result as any).created).toBeInstanceOf(Date);
      expect((result as any).created.toISOString()).toBe(
        '2024-01-15T12:00:00.000Z',
      );
    });

    it('should parse null values', () => {
      const result = plain.parse('value=null', {
        initialState: { value: null },
      });
      expect(result).toEqual({ value: null });
    });

    it('should parse objects in arrays from indexed notation', () => {
      const result = plain.parse('items.0.id=1,items.1.id=2', {
        initialState: { items: [{ id: 0 }] },
      });
      expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }] });
    });

    it('should handle escaped dots in keys', () => {
      const result = plain.parse('my_.key=value', {
        initialState: { 'my.key': '' },
      });
      expect(result).toEqual({ 'my.key': 'value' });
    });

    it('should handle escaped commas in values', () => {
      const result = plain.parse('text=a_,b_,c', {
        initialState: { text: '' },
      });
      expect(result).toEqual({ text: 'a,b,c' });
    });

    it('should handle escaped escape character', () => {
      // __ is just two underscores, not an escape sequence
      const result = plain.parse('path=a__b__c', {
        initialState: { path: '' },
      });
      expect(result).toEqual({ path: 'a__b__c' });
    });
  });

  describe('stringifyStandalone', () => {
    it('should return QueryStringParams format', () => {
      const result = plain.stringifyStandalone({
        name: 'John',
        tags: ['a', 'b'],
      });
      expect(result.name).toEqual(['John']);
      expect(result.tags).toEqual(['a', 'b']);
    });

    it('should handle nested objects', () => {
      const result = plain.stringifyStandalone({ user: { name: 'John' } });
      expect(result['user.name']).toEqual(['John']);
    });

    it('should URI encode values', () => {
      const result = plain.stringifyStandalone({ url: 'https://example.com' });
      // : is encoded as %3A, / is encoded as %2F (not our escape char anymore)
      expect(result.url).toEqual(['https%3A%2F%2Fexample.com']);
    });
  });

  describe('parseStandalone', () => {
    it('should parse QueryStringParams format', () => {
      const result = plain.parseStandalone(
        { name: ['John'], age: ['30'] },
        { initialState: { name: '', age: 0 } },
      );
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should handle arrays from multiple values', () => {
      const result = plain.parseStandalone(
        { tags: ['a', 'b', 'c'] },
        { initialState: { tags: [''] } },
      );
      expect(result).toEqual({ tags: ['a', 'b', 'c'] });
    });

    it('should handle nested paths', () => {
      const result = plain.parseStandalone(
        { 'user.name': ['John'], 'user.age': ['30'] },
        { initialState: { user: { name: '', age: 0 } } },
      );
      expect(result).toEqual({ user: { name: 'John', age: 30 } });
    });

    it('should decode URI encoded values', () => {
      // Values are URI encoded
      const result = plain.parseStandalone(
        { url: ['https%3A%2F%2Fexample.com'] },
        { initialState: { url: '' } },
      );
      expect(result).toEqual({ url: 'https://example.com' });
    });
  });

  describe('round-trip tests', () => {
    it('should round-trip simple objects', () => {
      const obj = { name: 'John', age: 30 };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip nested objects', () => {
      const obj = { user: { name: 'John', settings: { theme: 'dark' } } };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip simple arrays', () => {
      const obj = { tags: ['javascript', 'typescript', 'react'] };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip empty arrays', () => {
      const obj = { items: [] as string[] };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip dates', () => {
      const obj = { created: new Date('2024-01-15T12:00:00.000Z') };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect((parsed as any).created.toISOString()).toBe(
        obj.created.toISOString(),
      );
    });

    it('should round-trip booleans', () => {
      const obj = { enabled: true, disabled: false };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip null values', () => {
      const obj = { value: null };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip undefined values', () => {
      const obj = { value: undefined };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip number arrays', () => {
      const obj = { numbers: [1, 2, 3, 4, 5] };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip complex nested structure', () => {
      const obj = {
        user: {
          name: 'John',
          age: 30,
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
        filters: {
          categories: ['tech', 'science'],
          price: {
            min: 0,
            max: 100,
          },
        },
      };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip standalone mode', () => {
      const obj = { search: 'test', page: 1, tags: ['a', 'b'] };
      const serialized = plain.stringifyStandalone(obj);
      const parsed = plain.parseStandalone(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip objects in arrays', () => {
      const obj = {
        items: [
          { id: 1, name: 'foo' },
          { id: 2, name: 'bar' },
        ],
      };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip values with special characters', () => {
      const obj = { text: 'hello,world', path: 'a/b/c', key: 'with.dot' };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should round-trip keys with special characters', () => {
      const obj = { 'my.key': 'value1', 'another,key': 'value2' };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });
  });

  describe('format object interface', () => {
    it('should export plain as QueryStringFormat', () => {
      expect(plain.stringify).toBeDefined();
      expect(plain.parse).toBeDefined();
      expect(plain.stringifyStandalone).toBeDefined();
      expect(plain.parseStandalone).toBeDefined();
    });

    it('should work with the format interface', () => {
      const state = { count: 5, name: 'test' };
      const str = plain.stringify(state);
      const params = plain.stringifyStandalone(state);

      expect(plain.parse(str, { initialState: state })).toEqual(state);
      expect(plain.parseStandalone(params, { initialState: state })).toEqual(
        state,
      );
    });
  });

  describe('createFormat with custom options', () => {
    it('should allow custom entry separator', () => {
      const format = createFormat({ entrySeparator: '&' });
      const result = format.stringify({ a: 1, b: 2 });
      expect(result).toBe('a=1&b=2');
    });

    it('should allow custom nesting separator', () => {
      const format = createFormat({ nestingSeparator: '/' });
      const result = format.stringify({ user: { name: 'John' } });
      expect(result).toBe('user/name=John');
    });

    it('should allow custom escape character', () => {
      const format = createFormat({ escapeChar: '\\' });
      const result = format.stringify({ 'my.key': 'a,b' });
      // backslash is kept unencoded as the custom escape char marker
      expect(result).toBe('my\\.key=a\\,b');
    });

    it('should allow custom null string', () => {
      const format = createFormat({ nullString: 'NIL' });
      const result = format.stringify({ value: null });
      expect(result).toBe('value=NIL');
    });

    it('should allow custom undefined string', () => {
      const format = createFormat({ undefinedString: 'UNDEF' });
      const result = format.stringify({ value: undefined });
      expect(result).toBe('value=UNDEF');
    });

    it('should allow custom infinity string', () => {
      const format = createFormat({ infinityString: 'INF' });
      const result = format.stringify({ value: Infinity });
      expect(result).toBe('value=INF');
      const parsed = format.parse('value=INF', { initialState: { value: 0 } });
      expect((parsed as any).value).toBe(Infinity);
    });

    it('should allow custom negative infinity string', () => {
      const format = createFormat({ negativeInfinityString: 'NEG_INF' });
      const result = format.stringify({ value: -Infinity });
      expect(result).toBe('value=NEG_INF');
      const parsed = format.parse('value=NEG_INF', {
        initialState: { value: 0 },
      });
      expect((parsed as any).value).toBe(-Infinity);
    });

    it('should allow custom NaN string', () => {
      const format = createFormat({ nanString: 'NOT_A_NUMBER' });
      const result = format.stringify({ value: NaN });
      expect(result).toBe('value=NOT_A_NUMBER');
      const parsed = format.parse('value=NOT_A_NUMBER', {
        initialState: { value: 0 },
      });
      expect((parsed as any).value).toBeNaN();
    });

    it('should validate that entrySeparator and nestingSeparator are different', () => {
      expect(() =>
        createFormat({ entrySeparator: '.', nestingSeparator: '.' }),
      ).toThrow('entrySeparator and nestingSeparator cannot be the same');
    });

    it('should validate that escapeChar is different from separators', () => {
      expect(() => createFormat({ escapeChar: ',' })).toThrow(
        'escapeChar cannot be the same as a separator',
      );
    });

    it('should validate that separators are not empty', () => {
      expect(() => createFormat({ entrySeparator: '' })).toThrow(
        'Separators and escape character cannot be empty',
      );
    });

    it('should round-trip with custom options', () => {
      const format = createFormat({
        entrySeparator: '&',
        nestingSeparator: '/',
      });
      const obj = { user: { name: 'John', age: 30 }, tags: ['a', 'b'] };
      const serialized = format.stringify(obj);
      const parsed = format.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in values', () => {
      const obj = { url: 'https://example.com?foo=bar' };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should handle unicode characters', () => {
      const obj = { emoji: '🎉', chinese: '你好' };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should handle empty strings', () => {
      const obj = { empty: '' };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should handle very long strings', () => {
      const obj = { long: 'a'.repeat(1000) };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should handle zero', () => {
      const obj = { zero: 0 };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
      expect(typeof (parsed as any).zero).toBe('number');
    });

    it('should handle negative numbers', () => {
      const obj = { negative: -42, float: -3.14 };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should handle decimal numbers', () => {
      const obj = { pi: 3.14159 };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect((parsed as any).pi).toBeCloseTo(3.14159);
    });

    it('should handle scientific notation', () => {
      const obj = { big: 1e10, small: 1.5e-3, negative: -2.5e4 };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect((parsed as any).big).toBe(1e10);
      expect((parsed as any).small).toBeCloseTo(1.5e-3);
      expect((parsed as any).negative).toBe(-2.5e4);
    });

    it('should handle Infinity', () => {
      const obj = { value: Infinity };
      const serialized = plain.stringify(obj);
      expect(serialized).toBe('value=Infinity');
      const parsed = plain.parse(serialized, { initialState: obj });
      expect((parsed as any).value).toBe(Infinity);
    });

    it('should handle -Infinity', () => {
      const obj = { value: -Infinity };
      const serialized = plain.stringify(obj);
      expect(serialized).toBe('value=-Infinity');
      const parsed = plain.parse(serialized, { initialState: obj });
      expect((parsed as any).value).toBe(-Infinity);
    });

    it('should handle NaN', () => {
      const obj = { value: NaN };
      const serialized = plain.stringify(obj);
      expect(serialized).toBe('value=NaN');
      const parsed = plain.parse(serialized, { initialState: obj });
      expect((parsed as any).value).toBeNaN();
    });

    it('should auto-parse special numbers without hint', () => {
      const parsed = plain.parse('a=Infinity,b=-Infinity,c=NaN');
      expect((parsed as any).a).toBe(Infinity);
      expect((parsed as any).b).toBe(-Infinity);
      expect((parsed as any).c).toBeNaN();
    });

    it('should auto-parse scientific notation without hint', () => {
      const parsed = plain.parse('value=1.5e10');
      expect((parsed as any).value).toBe(1.5e10);
    });

    it('should skip function values', () => {
      const obj = { a: 1, b: () => {}, c: 2 };
      const serialized = plain.stringify(obj);
      expect(serialized).not.toContain('b=');
    });

    it('should return string when number parsing fails with hint', () => {
      const result = plain.parse('count=notanumber', {
        initialState: { count: 0 },
      });
      expect((result as any).count).toBe('notanumber');
    });

    it('should return string when boolean parsing fails with hint', () => {
      const result = plain.parse('enabled=notabool', {
        initialState: { enabled: false },
      });
      expect((result as any).enabled).toBe('notabool');
    });

    it('should return string when date parsing fails with hint', () => {
      const result = plain.parse('created=invalid-date', {
        initialState: { created: new Date() },
      });
      expect((result as any).created).toBe('invalid-date');
    });

    it('should auto-parse booleans without hint', () => {
      const result = plain.parse('flag=true', { initialState: {} });
      expect((result as any).flag).toBe(true);
    });

    it('should auto-parse numbers without hint', () => {
      const result = plain.parse('count=42', { initialState: {} });
      expect((result as any).count).toBe(42);
    });

    it('should auto-parse dates without hint', () => {
      const result = plain.parse('date=2024-01-15T12:00:00.000Z', {
        initialState: {},
      });
      expect((result as any).date).toBeInstanceOf(Date);
    });

    it('should handle nested array path hints', () => {
      const result = plain.parse('items.0.name=test,items.0.count=5', {
        initialState: { items: [{ name: '', count: 0 }] },
      });
      expect(result).toEqual({ items: [{ name: 'test', count: 5 }] });
      expect(typeof (result as any).items[0].count).toBe('number');
    });

    it('should handle empty input string', () => {
      const result = plain.parse('', { initialState: { a: 1 } });
      expect(result).toEqual({});
    });

    it('should handle entry without equals sign', () => {
      const result = plain.parse('invalid,key=value', {
        initialState: { key: '' },
      });
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle standalone mode with empty arrays', () => {
      const obj = { items: [] as string[] };
      const serialized = plain.stringifyStandalone(obj);
      const parsed = plain.parseStandalone(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should handle path through primitive hint', () => {
      const result = plain.parse('a.b.c=value', {
        initialState: { a: 'string' },
      });
      expect((result as any).a.b.c).toBe('value');
    });

    it('should handle decodeURI failure gracefully', () => {
      // decodeURI throws on malformed sequences
      const result = plain.parseStandalone(
        { key: ['%E0%A4%A'] }, // malformed UTF-8
        { initialState: { key: '' } },
      );
      expect((result as any).key).toBe('%E0%A4%A');
    });

    it('should handle complex objects in arrays', () => {
      const obj = {
        users: [
          { id: 1, name: 'Alice', active: true },
          { id: 2, name: 'Bob', active: false },
        ],
      };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect(parsed).toEqual(obj);
    });

    it('should handle dates in arrays', () => {
      const obj = {
        dates: [
          new Date('2024-01-15T00:00:00.000Z'),
          new Date('2024-12-25T00:00:00.000Z'),
        ],
      };
      const serialized = plain.stringify(obj);
      const parsed = plain.parse(serialized, { initialState: obj });
      expect((parsed as any).dates[0]).toBeInstanceOf(Date);
      expect((parsed as any).dates[1]).toBeInstanceOf(Date);
    });

    it('should handle sparse arrays', () => {
      const result = plain.parse('arr.0=first,arr.2=third', {
        initialState: { arr: [''] },
      });
      expect((result as any).arr[0]).toBe('first');
      expect((result as any).arr[1]).toBe(undefined);
      expect((result as any).arr[2]).toBe('third');
    });

    it('should keep strings when hint is string', () => {
      const result = plain.parse('value=123', {
        initialState: { value: 'default' },
      });
      expect((result as any).value).toBe('123');
      expect(typeof (result as any).value).toBe('string');
    });

    it('should handle array hint with element type', () => {
      const result = plain.parse('nums=1,nums=2,nums=3', {
        initialState: { nums: [0] },
      });
      expect(result).toEqual({ nums: [1, 2, 3] });
      expect(
        (result as any).nums.every((n: unknown) => typeof n === 'number'),
      ).toBe(true);
    });

    it('should use array element hint for type coercion', () => {
      // This specifically tests the recursive parseValue call with hint[0]
      const result = plain.parse('values=42', {
        initialState: { values: [0] },
      });
      expect(result).toEqual({ values: [42] });
      expect(typeof (result as any).values[0]).toBe('number');
    });

    it('should use nested array element hint for type coercion', () => {
      // Test array element hint when traversing through getHintAtPath
      const result = plain.parse('items.0.count=5', {
        initialState: { items: [{ count: 0 }] },
      });
      expect((result as any).items[0].count).toBe(5);
      expect(typeof (result as any).items[0].count).toBe('number');
    });

    it('should handle escape char at end of string', () => {
      // Trailing underscore is not an escape sequence, so it's kept
      const result = plain.parse('key=value_', { initialState: { key: '' } });
      expect((result as any).key).toBe('value_');
    });

    it('should handle multiple values without array hint', () => {
      // Test multiple values for a key without array hint - should create array
      const result = plain.parse('tag=a,tag=b,tag=c', { initialState: {} });
      expect((result as any).tag).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty parts in namespaced string', () => {
      // With default arraySep='repeat', commas are entry separators.
      // 'a=1,,b=2': entry "a=1", empty continuation, then "b=2".
      // The empty part is a continuation of a's value → a gets "1,"
      const result = plain.parse('a=1,,b=2', { initialState: { a: '', b: 0 } });
      expect(result).toEqual({ a: '1,', b: 2 });
    });

    it('should handle parse without context', () => {
      // Test parse with undefined context
      const result = plain.parse('name=John,age=30');
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should handle parse with context but no initialState', () => {
      // Test parse with context that has no initialState
      const result = plain.parse('name=John', {} as any);
      expect(result).toEqual({ name: 'John' });
    });

    it('should handle Infinity with number hint', () => {
      // Plain format supports Infinity, -Infinity, and NaN as special number values
      const result = plain.parse('value=Infinity', {
        initialState: { value: 0 },
      });
      expect(result).toEqual({ value: Infinity });
    });

    it('should handle invalid ISO date that matches pattern', () => {
      // Date string matches ISO pattern but creates an Invalid Date
      // Plain format's tryParseDate returns null for invalid dates, so it stays as string
      const result = plain.parse('date=2024-99-99T00:00:00.000Z', {
        initialState: { date: new Date() },
      });
      expect(result).toEqual({ date: '2024-99-99T00:00:00.000Z' });
    });
  });

  describe('URI encoding', () => {
    it('should properly encode space in value (namespaced)', () => {
      const state = { text: 'hello world' };
      const encoded = plain.stringify(state);
      expect(encoded).toContain('%20');
      expect(plain.parse(encoded, { initialState: state })).toEqual(state);
    });

    it('should properly encode space in key (namespaced)', () => {
      const state = { 'hello world': 'value' };
      const encoded = plain.stringify(state);
      expect(encoded).toContain('%20');
      expect(plain.parse(encoded, { initialState: state })).toEqual(state);
    });

    it('should properly encode accented characters (namespaced)', () => {
      const state = { text: 'café', key: 'árvíztűrő' };
      const encoded = plain.stringify(state);
      expect(encoded).toContain('%C3%A9'); // é encoded
      expect(plain.parse(encoded, { initialState: state })).toEqual(state);
    });

    it('should properly encode space in standalone value', () => {
      const state = { text: 'hello world' };
      const params = plain.stringifyStandalone(state);
      expect(params.text[0]).toContain('%20');
      expect(plain.parseStandalone(params, { initialState: state })).toEqual(
        state,
      );
    });

    it('should properly encode space in standalone key', () => {
      const state = { 'hello world': 'value' };
      const params = plain.stringifyStandalone(state);
      expect(Object.keys(params)[0]).toContain('%20');
      expect(plain.parseStandalone(params, { initialState: state })).toEqual(
        state,
      );
    });

    it('should properly encode arrays with spaces (namespaced)', () => {
      const state = { items: ['hello world', 'foo bar'] };
      const encoded = plain.stringify(state);
      expect(encoded).toContain('%20');
      expect(plain.parse(encoded, { initialState: state })).toEqual(state);
    });

    it('should round-trip through URL', () => {
      const state = { text: 'hello world', key: 'árvíztűrő' };
      const encoded = plain.stringify(state);

      // Simulate URL param round-trip
      const url = new URL('http://example.com');
      url.searchParams.set('state', encoded);
      const fromUrl = url.searchParams.get('state')!;

      expect(plain.parse(fromUrl, { initialState: state })).toEqual(state);
    });

    it('should not have raw spaces in output', () => {
      const state = {
        'key with space': 'value with space',
        arr: ['item with space'],
      };
      const encoded = plain.stringify(state);
      expect(encoded).not.toContain(' ');
      expect(plain.parse(encoded, { initialState: state })).toEqual(state);
    });
  });

  describe('stringifyStandalone should encode keys for URL safety', () => {
    it('should encode space in key', () => {
      const state = { 'key with space': 'value' };
      const params = plain.stringifyStandalone(state);
      const keys = Object.keys(params);

      expect(keys[0]).toBe('key%20with%20space');
      expect(keys[0]).not.toContain(' ');
    });

    it('should encode accented characters in key', () => {
      const state = { café: 'coffee' };
      const params = plain.stringifyStandalone(state);
      const keys = Object.keys(params);

      expect(keys[0]).toBe('caf%C3%A9');
      expect(keys[0]).not.toContain('é');
    });

    it('should encode nested keys with special characters', () => {
      const state = { 'hello world': { 'nested key': 'value' } };
      const params = plain.stringifyStandalone(state);
      const keys = Object.keys(params);

      // Should have encoded key like "hello%20world.nested%20key"
      expect(keys[0]).toContain('%20');
      expect(keys[0]).not.toContain(' ');
    });

    it('should round-trip keys with special characters', () => {
      const state = {
        'key with space': 'value',
        café: 'coffee',
        árvíz: 'flood',
      };
      const params = plain.stringifyStandalone(state);
      const parsed = plain.parseStandalone(params, { initialState: state });

      expect(parsed).toEqual(state);
    });

    it('should produce URL-safe keys that can be used directly', () => {
      const state = { 'hello world': 'test value', nested: { deep: 1 } };
      const params = plain.stringifyStandalone(state);

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

describe('plain format - validation errors', () => {
  it('should throw when arraySeparator equals nestingSeparator', () => {
    expect(() =>
      createFormat({ arraySeparator: '.', nestingSeparator: '.' }),
    ).toThrow('arraySeparator cannot be the same as nestingSeparator');
  });

  it('should throw when arraySeparator equals escapeChar', () => {
    expect(() =>
      createFormat({ arraySeparator: '_', escapeChar: '_' }),
    ).toThrow('arraySeparator cannot be the same as escapeChar');
  });

  it('should throw when arraySeparator is empty string', () => {
    expect(() => createFormat({ arraySeparator: '' })).toThrow(
      'arraySeparator cannot be empty',
    );
  });
});

describe('plain format - arraySeparator: "repeat" in namespaced mode', () => {
  const fmt = createFormat({ arraySeparator: 'repeat' });

  it('should stringify arrays as repeated keys in namespaced mode', () => {
    const result = fmt.stringify({ tags: ['a', 'b', 'c'] });
    // With repeat, each array element gets its own key=value
    expect(result).toContain('tags=a');
    expect(result).toContain('tags=b');
    expect(result).toContain('tags=c');
  });

  it('should round-trip arrays in namespaced mode', () => {
    const obj = { tags: ['x', 'y'], name: 'test' };
    const str = fmt.stringify(obj);
    const parsed = fmt.parse(str, { initialState: obj });
    expect(parsed).toEqual(obj);
  });
});

describe('plain format - arraySeparator: "repeat" in standalone mode', () => {
  const fmt = createFormat({ arraySeparator: 'repeat' });

  it('should stringify arrays as repeated keys in standalone mode', () => {
    const params = fmt.stringifyStandalone({ tags: ['a', 'b'] });
    expect(params['tags']).toEqual(['a', 'b']);
  });

  it('should round-trip arrays in standalone mode', () => {
    const obj = { tags: ['x', 'y'], name: 'test' };
    const params = fmt.stringifyStandalone(obj);
    const parsed = fmt.parseStandalone(params, { initialState: obj });
    expect(parsed).toEqual(obj);
  });
});

describe('plain format - dynamic filter keys (no array hint)', () => {
  // Reproduces: filters.gpus_.architecture=Blackwell,Ada parsed as single string
  const initialState = { query: '', filters: {} as Record<string, string[]> };

  it('should split comma-separated values into array even without hint (standalone)', () => {
    const commaFmt = createFormat({ arraySeparator: ',' });
    const params = {
      'filters.gpus_.architecture': ['Blackwell,Ada'],
      query: ['ubuntu'],
    };
    const parsed = commaFmt.parseStandalone(params, { initialState }) as any;
    expect(parsed.filters['gpus.architecture']).toEqual(['Blackwell', 'Ada']);
    expect(parsed.query).toBe('ubuntu');
  });

  it('should NOT split escaped commas (standalone)', () => {
    const commaFmt = createFormat({ arraySeparator: ',' });
    // "_," is an escaped comma — should remain literal
    const params = { search: ['hello_,%20world'] };
    const parsed = commaFmt.parseStandalone(params, {
      initialState: { search: '' },
    }) as any;
    expect(parsed.search).toBe('hello, world');
  });

  it('should split comma-separated values into array even without hint (namespaced)', () => {
    const commaFmt = createFormat({ arraySeparator: ',' });
    const str = 'filters.gpus_.architecture=Blackwell,Ada,query=ubuntu';
    const parsed = commaFmt.parse(str, { initialState }) as any;
    expect(parsed.filters['gpus.architecture']).toEqual(['Blackwell', 'Ada']);
    expect(parsed.query).toBe('ubuntu');
  });

  it('should work with colon nesting separator', () => {
    const fmt = createFormat({ nestingSeparator: ':', arraySeparator: ',' });
    const params = { 'filters:gpus.architecture': ['Blackwell,Ada'] };
    const parsed = fmt.parseStandalone(params, { initialState }) as any;
    expect(parsed.filters['gpus.architecture']).toEqual(['Blackwell', 'Ada']);
  });

  it('should round-trip dynamic filter keys (standalone)', () => {
    const state = {
      query: 'ubuntu',
      filters: { 'gpus.architecture': ['Blackwell', 'Ada'] },
    };
    const params = plain.stringifyStandalone(state);
    const parsed = plain.parseStandalone(params, { initialState });
    expect(parsed).toEqual(state);
  });
});

describe('plain format - findUnescaped with escape sequences', () => {
  // Exercises the findUnescaped branch that skips escaped chars (L375-378)
  it('should parse namespaced entry where key contains escaped =', () => {
    // key "a_=b" has an escaped "=" — the parser must skip it and find the real "="
    const fmt = createFormat();
    const parsed = fmt.parse('a_==hello', {
      initialState: { 'a=': '' },
    }) as any;
    expect(parsed['a=']).toBe('hello');
  });

  it('should parse namespaced entry where value contains escaped entry separator', () => {
    const fmt = createFormat();
    // value "a_,b" has escaped "," — should be kept as literal comma
    const parsed = fmt.parse('text=a_,b', {
      initialState: { text: '' },
    }) as any;
    expect(parsed.text).toBe('a,b');
  });
});

describe('plain format - non-finite number parsing', () => {
  it('should return null for numbers that parse to Infinity via parseFloat', () => {
    // "1e999" matches NUMBER_RE but parseFloat returns Infinity → isFinite fails → null
    // Without a hint, this falls through to string
    const params = { val: ['1e999'] };
    const parsed = plain.parseStandalone(params, {
      initialState: { val: '' },
    }) as any;
    expect(parsed.val).toBe('1e999');
  });

  it('should auto-parse 1e999 as string when there is no hint', () => {
    const parsed = plain.parse('val=1e999') as any;
    // auto-parse: tryParseNumber returns null (non-finite) → kept as string
    expect(parsed.val).toBe('1e999');
  });
});
