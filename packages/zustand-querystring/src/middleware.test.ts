import { describe, it, expect } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { json } from './format/json';
import { plain, createFormat as createPlainFormat } from './format/plain';
import { compact, querystring, type ParseContext } from './middleware';

describe('compact', () => {
  it('should remove values equal to initial state', () => {
    const initialState = { a: 1, b: 2, c: 3 };
    const newState = { a: 1, b: 5, c: 3 };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ b: 5 });
  });

  it('should handle nested objects inside class instances', () => {
    class User {
      constructor(
        public name: string,
        public metadata: { role: string },
      ) {}
    }

    const user1 = new User('John', { role: 'admin' });
    const user2 = new User('John', { role: 'user' });

    const initialState = { user: user1 };
    const newState = { user: user2 };
    const result = compact(newState, initialState);

    // Class instances are atomic - different metadata means whole instance is included
    expect(result.output).toEqual({ user: user2 });
  });

  it('should strip null by default (syncNull=false)', () => {
    const initialState = { name: 'John', age: 30 };
    const newState = { name: null, age: 30 };
    const result = compact(newState, initialState);
    // With syncNull=false (default), null values are not synced
    expect(result.output).toEqual({});
  });

  it('should sync null when syncNull=true', () => {
    const initialState = { name: 'John', age: 30 };
    const newState = { name: null, age: 30 };
    const result = compact(newState, initialState, true, false);
    // With syncNull=true, null is synced when it differs from initial
    expect(result.output).toEqual({ name: null });
  });

  it('should preserve null in nested objects when syncNull=true', () => {
    const initialState = { user: { name: 'John', email: 'john@example.com' } };
    const newState = { user: { name: 'John', email: null } };
    const result = compact(newState, initialState, true);
    expect(result.output).toEqual({ user: { email: null } });
  });

  it('should strip undefined by default (syncUndefined=false)', () => {
    const initialState = { a: 1, b: 2 };
    const newState = { a: 1, b: undefined };
    const result = compact(newState, initialState);
    // With syncUndefined=false (default), undefined values are not synced
    expect(result.output).toEqual({});
  });

  it('should sync undefined when syncUndefined=true', () => {
    const initialState = { a: 1, b: 2 };
    const newState = { a: 1, b: undefined };
    const result = compact(newState, initialState, false, true);
    // With syncUndefined=true, undefined is synced when it differs from initial
    expect(result.output).toEqual({ b: undefined });
  });

  it('should handle undefined in initial state', () => {
    const initialState = { a: 1, b: undefined };
    const newState = { a: 1, b: undefined };
    const result = compact(newState, initialState);
    // Same as initial, should not be synced
    expect(result.output).toEqual({});
  });

  it('should remove function values', () => {
    const initialState = { a: 1, b: () => {} };
    const newState = { a: 5, b: () => {} };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ a: 5 });
  });

  it('should handle nested objects', () => {
    const initialState = {
      user: { name: 'John', age: 30 },
      count: 0,
    };
    const newState = {
      user: { name: 'Jane', age: 30 },
      count: 0,
    };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ user: { name: 'Jane' } });
  });

  it('should handle arrays', () => {
    const initialState = { items: [1, 2, 3], count: 0 };
    const newState = { items: [1, 2, 4], count: 0 };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ items: [1, 2, 4] });
  });

  it('should remove empty nested objects', () => {
    const initialState = {
      user: { name: 'John', age: 30 },
      count: 5,
    };
    const newState = {
      user: { name: 'John', age: 30 },
      count: 5,
    };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({});
  });

  it('should handle deeply nested changes', () => {
    const initialState = {
      a: { b: { c: { d: 1 } } },
      x: 10,
    };
    const newState = {
      a: { b: { c: { d: 2 } } },
      x: 10,
    };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ a: { b: { c: { d: 2 } } } });
  });

  it('should handle null as a value in initial state', () => {
    const initialState = { name: null, age: 30 };
    const newState = { name: 'John', age: 30 };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ name: 'John' });
  });

  it('should handle objects with null values when syncNull=true', () => {
    const initialState = { user: { name: 'John' }, count: 0 };
    const newState = { user: null, count: 5 };
    const result = compact(newState, initialState, true);
    expect(result.output).toEqual({ user: null, count: 5 });
  });

  it('should handle complex mixed scenarios', () => {
    const initialState = {
      name: 'John',
      age: 30,
      settings: { theme: 'dark', notifications: true },
      items: [1, 2, 3],
    };
    const newState = {
      name: 'John',
      age: 31,
      settings: { theme: 'light', notifications: true },
      items: [1, 2, 3],
    };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({
      age: 31,
      settings: { theme: 'light' },
    });
  });

  it('should preserve zero values', () => {
    const initialState = { count: 5 };
    const newState = { count: 0 };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ count: 0 });
  });

  it('should preserve false values', () => {
    const initialState = { enabled: true };
    const newState = { enabled: false };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ enabled: false });
  });

  it('should preserve empty strings', () => {
    const initialState = { name: 'John' };
    const newState = { name: '' };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ name: '' });
  });

  it('should handle NaN values', () => {
    const initialState = { value: 5 };
    const newState = { value: NaN };
    const result = compact(newState, initialState);
    // NaN !== NaN, so it should be included
    expect(result.output).toEqual({ value: NaN });
  });

  it('should handle Infinity values', () => {
    const initialState = { value: 5 };
    const newState = { value: Infinity };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ value: Infinity });
  });

  it('should handle Date objects', () => {
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2024-01-02');
    const initialState = { created: date1 };
    const newState = { created: date2 };
    const result = compact(newState, initialState);
    // lodash isEqual compares Date objects by value
    expect(result.output).toEqual({ created: date2 });
  });

  it('should handle same Date objects', () => {
    const date = new Date('2024-01-01');
    const initialState = { created: date };
    const newState = { created: new Date('2024-01-01') };
    const result = compact(newState, initialState);
    // lodash isEqual considers these equal
    expect(result.output).toEqual({});
  });

  it('should handle empty arrays vs non-empty', () => {
    const initialState = { items: [] };
    const newState = { items: [1, 2, 3] };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ items: [1, 2, 3] });
  });

  it('should handle non-empty arrays vs empty', () => {
    const initialState = { items: [1, 2, 3] };
    const newState = { items: [] };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ items: [] });
  });

  it('should handle nested null in arrays', () => {
    const initialState = { items: [1, 2, 3] };
    const newState = { items: [1, null, 3] };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ items: [1, null, 3] });
  });

  it('should handle objects in arrays', () => {
    const initialState = { users: [{ id: 1, name: 'John' }] };
    const newState = { users: [{ id: 1, name: 'Jane' }] };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ users: [{ id: 1, name: 'Jane' }] });
  });

  it('should handle missing keys in new state', () => {
    const initialState = { a: 1, b: 2, c: 3 };
    const newState = { a: 1, c: 3 };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({});
  });

  it('should handle extra keys in new state', () => {
    const initialState = { a: 1, b: 2 };
    const newState = { a: 1, b: 2, c: 3 };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ c: 3 });
  });

  it('should handle deeply nested null when syncNull=true', () => {
    const initialState = { a: { b: { c: { d: 'value' } } } };
    const newState = { a: { b: { c: { d: null } } } };
    const result = compact(newState, initialState, true);
    expect(result.output).toEqual({ a: { b: { c: { d: null } } } });
  });

  it('should handle changing object to null when syncNull=true', () => {
    const initialState = { settings: { theme: 'dark' } };
    const newState = { settings: null };
    const result = compact(newState, initialState, true);
    expect(result.output).toEqual({ settings: null });
  });

  it('should handle changing null to object', () => {
    const initialState = { settings: null };
    const newState = { settings: { theme: 'dark' } };
    const result = compact(newState, initialState);
    // This works because typeof null === 'object' but we check !isNull
    expect(result.output).toEqual({ settings: { theme: 'dark' } });
  });

  it('should handle changing array to null when syncNull=true', () => {
    const initialState = { items: [1, 2, 3] };
    const newState = { items: null };
    const result = compact(newState, initialState, true);
    expect(result.output).toEqual({ items: null });
  });

  it('should handle changing string to number', () => {
    const initialState = { value: '5' };
    const newState = { value: 5 };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ value: 5 });
  });

  it('should handle objects with symbol keys', () => {
    const sym = Symbol('test');
    const initialState = { [sym]: 1, normal: 2 };
    const newState = { [sym]: 1, normal: 3 };
    const result = compact(newState, initialState);
    // Symbols are not enumerable via Object.keys
    expect(result.output).toEqual({ normal: 3 });
  });

  it('should handle empty object in initial state', () => {
    const initialState = {};
    const newState = { a: 1, b: 2 };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ a: 1, b: 2 });
  });

  it('should handle empty object in new state', () => {
    const initialState = { a: 1, b: 2 };
    const newState = {};
    const result = compact(newState, initialState);
    expect(result.output).toEqual({});
  });

  it('should handle RegExp objects', () => {
    const initialState = { pattern: /test/ };
    const newState = { pattern: /test2/ };
    const result = compact(newState, initialState);
    // lodash isEqual compares RegExp by their source and flags
    expect(result.output).toEqual({ pattern: /test2/ });
  });

  it('should handle nested array changes', () => {
    const initialState = {
      matrix: [
        [1, 2],
        [3, 4],
      ],
    };
    const newState = {
      matrix: [
        [1, 2],
        [3, 5],
      ],
    };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({
      matrix: [
        [1, 2],
        [3, 5],
      ],
    });
  });

  it('should handle partial nested object updates', () => {
    const initialState = {
      user: { name: 'John', age: 30, email: 'john@example.com' },
    };
    const newState = {
      user: { name: 'John', age: 31, email: 'john@example.com' },
    };
    const result = compact(newState, initialState);
    expect(result.output).toEqual({ user: { age: 31 } });
  });

  it('should not mutate input objects', () => {
    const initialState = { a: 1, b: { c: 2 } };
    const newState = { a: 5, b: { c: 3 } };
    const initialStateCopy = JSON.parse(JSON.stringify(initialState));
    const newStateCopy = JSON.parse(JSON.stringify(newState));

    compact(newState, initialState);

    expect(initialState).toEqual(initialStateCopy);
    expect(newState).toEqual(newStateCopy);
  });

  it('should handle class instances and diff by properties', () => {
    class User {
      constructor(
        public name: string,
        public age: number,
      ) {}
      greet() {
        return `Hello ${this.name}`;
      }
    }

    const user1 = new User('John', 30);
    const user2 = new User('Jane', 25);

    const initialState = { user: user1 };
    const newState = { user: user2 };
    const result = compact(newState, initialState);

    // Class instances are treated as atomic values (not recursed into)
    // They are compared by lodash isEqual which does deep property comparison
    expect(result.output).toEqual({ user: user2 });
    expect((result.output as any).user).toBeInstanceOf(User);
  });

  it('should handle same class instances', () => {
    class User {
      constructor(
        public name: string,
        public age: number,
      ) {}
    }

    const user = new User('John', 30);
    const initialState = { user };
    const newState = { user };
    const result = compact(newState, initialState);

    // Same reference, should be removed
    expect(result.output).toEqual({});
  });

  it('should handle class instance property changes', () => {
    class User {
      constructor(
        public name: string,
        public age: number,
      ) {}
    }

    const user1 = new User('John', 30);
    const user2 = new User('John', 30);

    const initialState = { user: user1 };
    const newState = { user: user2 };
    const result = compact(newState, initialState);

    // Different instances with same values - lodash isEqual checks deep equality
    // For classes, it compares by properties not reference
    expect(result.output).toEqual({});
  });

  it('should handle nested objects inside class instances', () => {
    class User {
      constructor(
        public name: string,
        public metadata: { role: string },
      ) {}
    }

    const user1 = new User('John', { role: 'admin' });
    const user2 = new User('John', { role: 'user' });

    const initialState = { user: user1 };
    const newState = { user: user2 };
    const result = compact(newState, initialState);

    // Class instances are atomic - different metadata means whole instance is included
    expect(result.output).toEqual({ user: user2 });
  });

  it('keeps a forced key at its initial value', () => {
    const initialState = { a: 1, b: 1 };
    const newState = { a: 1, b: 2 };
    const result = compact(newState, initialState, false, false, ['a']);
    expect(result.output).toEqual({ a: 1, b: 2 });
  });

  it('compares nothing inside a forced key, and applies the flags there', () => {
    const initialState = { inner: { v: 'x', w: 'x', n: 'x' } };
    const newState = { inner: { v: 'x', w: undefined, n: null } };
    const result = compact(newState, initialState, false, true, ['inner']);
    expect(result.output).toStrictEqual({ inner: { v: 'x', w: undefined } });
  });
});

describe('url option', () => {
  it('an undefined in the URL sets the key only with syncUndefined', () => {
    const create = (syncUndefined: boolean) =>
      createStore<{ tag?: string }>()(
        querystring(() => ({ tag: 'all' }), {
          url: '/?tag=:undefined',
          syncUndefined,
        }),
      );

    expect(create(false).getState()).toStrictEqual({ tag: 'all' });
    expect(create(true).getState()).toStrictEqual({ tag: undefined });
  });

  it('with the plain format, an empty value reads as an empty string, null or undefined, not an empty object', () => {
    for (const mode of [{}, { key: 'state', prefix: 'a_' }]) {
      for (const [format, value] of [
        [plain, ''],
        [createPlainFormat({ nullString: '' }), null],
        [createPlainFormat({ undefinedString: '' }), undefined],
      ] as const) {
        const content = { filters: value };
        const search =
          'key' in mode
            ? 'a_state=' + format.stringify(content)
            : 'filters=' + format.stringifyStandalone(content).filters[0];
        const store = createStore<{
          filters: Record<string, string> | string | null | undefined;
        }>()(
          querystring(() => ({ filters: {} }), {
            ...mode,
            format,
            syncNull: true,
            syncUndefined: true,
            url: '/review?' + search,
          }),
        );

        expect(store.getState().filters).toBe(value);
      }
    }
  });

  it('a URL key never replaces an action, nor an object holding one', () => {
    const store = createStore<{
      search: () => number;
      menu: { nested: { toggle: () => number } };
    }>()(
      querystring(
        () => ({ search: () => 1, menu: { nested: { toggle: () => 2 } } }),
        { url: '/results?search=acme&menu=.' },
      ),
    );

    expect(store.getState().search()).toBe(1);
    expect(store.getState().menu.nested.toggle()).toBe(2);
  });

  it('a URL key merges into a class instance, keeping its private fields', () => {
    class Filter {
      #scope = 'all';
      rating = 0;
      label() {
        return this.#scope + ':' + this.rating;
      }
    }
    const store = createStore<{ filter: Filter }>()(
      querystring(() => ({ filter: new Filter() }), {
        url: '/results?filter=.rating:4',
        select: () => ({ filter: { rating: true } }),
      }),
    );

    expect(store.getState().filter.label()).toBe('all:4');
  });

  it('with select, a format parses with the selected initial state', () => {
    // Writes the values in order and reads them back by the keys' order.
    const format = {
      stringify: (state: object) => JSON.stringify(Object.values(state)),
      parse: (value: string, ctx?: ParseContext) => {
        const keys = Object.keys(ctx!.initialState);
        return Object.fromEntries(
          JSON.parse(decodeURIComponent(value)).map((v: unknown, i: number) => [
            keys[i],
            v,
          ]),
        );
      },
    };
    const store = createStore(
      querystring(() => ({ sort: 'recent', count: 0 }), {
        url: '/review?state=%5B3%5D',
        key: 'state',
        select: () => ({ count: true }),
        format,
      }),
    );

    expect(store.getState()).toEqual({ sort: 'recent', count: 3 });
  });

  it('an empty object in the URL leaves a class instance as it is', () => {
    class Filter {
      rating = 2;
    }
    const filter = new Filter();
    const store = createStore<{ filter: Filter }>()(
      querystring(() => ({ filter }), { url: '/results?filter=.' }),
    );

    expect(store.getState().filter).toBe(filter);
  });
});

describe('href', () => {
  it('works on the server, with the url option', () => {
    const store = createStore<{ count: number; other: number }>()(
      querystring(() => ({ count: 0, other: 0 }), { url: '/a?count=:5' }),
    );

    expect(decodeURIComponent(store.href('/b', { other: 0 }))).toBe(
      '/b?count=:5&other=:0',
    );
  });

  it('writes a passed undefined, with syncUndefined', () => {
    const store = createStore<{ filter?: string }>()(
      querystring(() => ({}), { url: '/a?filter=active', syncUndefined: true }),
    );

    expect(decodeURIComponent(store.href('/b', { filter: undefined }))).toBe(
      '/b?filter=:undefined',
    );
  });

  it('writes a passed undefined with the json format, which a store reads back', () => {
    const create = (url: string) =>
      createStore<{ tag?: string }>()(
        querystring(() => ({ tag: 'active' }), {
          url,
          format: json,
          syncUndefined: true,
        }),
      );

    const href = create('/a').href('/b', { tag: undefined });
    expect(href).toBe('/b?tag=undefined');
    expect(create(href).getState()).toStrictEqual({ tag: undefined });
  });

  it('with map, forces the mapped keys only when select keeps a passed key', () => {
    const store = createStore<{ count: number; hidden: number }>()(
      querystring(() => ({ count: 0, hidden: 3 }), {
        url: '/results',
        select: pathname => ({ count: true, hidden: pathname === '/admin' }),
        map: {
          to: state => ({ n: state.count }),
          from: urlState => ({ count: urlState.n as number }),
        },
      }),
    );

    expect(store.href('/results', { hidden: 7 })).toBe('/results');
    expect(decodeURIComponent(store.href('/results', { count: 0 }))).toBe(
      '/results?n=:0',
    );
  });

  it('leaves out nested null and undefined, without syncNull and syncUndefined', () => {
    const store = createStore<{ inner: { v: string | null; w?: string } }>()(
      querystring(() => ({ inner: { v: 'x', w: 'x' } }), { url: '/a' }),
    );

    expect(store.href('/b', { inner: { v: null, w: undefined } })).toBe('/b');
  });

  it('with select, leaves out an object none of whose fields are selected', () => {
    const store = createStore<{
      filters: { shown?: string; hidden?: string };
    }>()(
      querystring(() => ({ filters: { shown: 'open' } }), {
        url: '/review',
        select: () => ({ filters: { shown: true } }),
        map: {
          // map.to gets the object even when select keeps none of its fields.
          to: state => ({ v: state.filters.shown ?? 'open' }),
          from: urlState => ({ filters: { shown: urlState.v as string } }),
        },
      }),
    );

    expect(store.href('/review', { filters: { hidden: 'internal' } })).toBe(
      '/review',
    );
    expect(store.href('/review', { filters: {} })).toBe('/review?v=open');
  });
});

describe('server store: setDefaults', () => {
  it.each([
    ['with url', { url: '/?count=:3' }],
    ['without url', {}],
  ] as const)('%s: setDefaults can be called', (_, options) => {
    const store = createStore(querystring(() => ({ count: 0 }), options));
    expect(() => store.setDefaults({ count: 5 })).not.toThrow();
  });

  it.each([
    ['with url', { url: '/review' }],
    ['without url', {}],
  ] as const)('%s: setDefaults works inside the initializer', (_, options) => {
    const store = createStore<{ view: string }>()(
      querystring((_set, _get, api) => {
        api.setDefaults({ view: 'list' });
        return { view: 'grid' };
      }, options),
    );

    expect(store.getState().view).toBe('grid');
    expect(store.href('/review')).toBe('/review?view=grid');
  });
});
