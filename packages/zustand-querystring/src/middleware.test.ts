import { describe, it, expect } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { createStore } from 'zustand/vanilla';
import {
  compact,
  createMap,
  querystring,
  type ParseContext,
  type QueryStringFormat,
} from './middleware';
import { marked } from './format/marked';
import { plain, createFormat as createPlainFormat } from './format/plain';
import { json } from './format/json';

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

  it('keeps an empty object over a non-empty initial one', () => {
    const initialState = {
      filters: { query: 'default' },
      other: { a: 1, b: 2 },
    };
    // other's fields compact away, which leaves out other itself.
    const newState = { filters: {}, other: { a: 1 } };
    const result = compact(newState, initialState);
    expect(result.output).toStrictEqual({ filters: {} });
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

  it('an empty object clears only the fields select syncs in it', () => {
    const store = createStore<{
      filters: {
        query?: string;
        localSort: string;
        paging: { page?: number; size: number };
        actions: { next: () => number };
      };
    }>()(
      querystring(
        () => ({
          filters: {
            query: 'default',
            localSort: 'newest',
            paging: { page: 2, size: 20 },
            actions: { next: () => 3 },
          },
        }),
        {
          url: '/report?filters=.',
          select: () => ({
            filters: { query: true, paging: { page: true }, actions: true },
          }),
        },
      ),
    );

    const { filters } = store.getState();
    expect('query' in filters).toBe(false);
    expect(filters.localSort).toBe('newest');
    expect(filters.paging).toStrictEqual({ size: 20 });
    expect(filters.actions.next()).toBe(3);
  });

  it('gives each store its own copy of an object map.from returns', () => {
    const presets = { eu: { region: 'EU' } };
    const create = () =>
      createStore<{ filters?: { region: string } }>()(
        querystring(() => ({}), {
          url: '/report?preset=eu',
          map: {
            to: state => ({ preset: state.filters ? 'eu' : '' }),
            from: urlState => ({
              filters: presets[urlState.preset as 'eu'],
            }),
          },
        }),
      );

    const first = create();
    expect(first.getState().filters).not.toBe(presets.eu);
    first.getState().filters!.region = 'APAC';

    expect(presets.eu.region).toBe('EU');
    expect(create().getState().filters).toStrictEqual({ region: 'EU' });
  });

  it('copies a circular object map.from returns as the same cycle', () => {
    type Filters = { region: string; self?: Filters };
    const preset: Filters = { region: 'EU' };
    preset.self = preset;
    const store = createStore<{ page: number; filters?: Filters }>()(
      querystring(() => ({ page: 1 }), {
        url: '/report?page=:2',
        map: {
          to: state => ({ page: state.page }),
          from: urlState => ({
            page: urlState.page as number,
            filters: preset,
          }),
        },
      }),
    );

    const { page, filters } = store.getState();
    expect(page).toBe(2);
    expect(filters!.region).toBe('EU');
    expect(filters).not.toBe(preset);
    expect(filters!.self).toBe(filters);
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

  it('reads the URL when the state holds a circular object map.to leaves out', () => {
    type Graph = { id: number; parent?: Graph };
    const create = (url: string, from: (id: number) => Graph) => {
      const graph: Graph = { id: 1 };
      graph.parent = graph;
      return createStore<{ graph: Graph; count: number }>()(
        querystring(() => ({ graph, count: 0 }), {
          url,
          map: {
            to: state => ({ id: state.graph.id, count: state.count }),
            from: urlState => ({
              graph: from(urlState.id as number),
              count: urlState.count as number,
            }),
          },
        }),
      );
    };

    const merged = create('/review?id=:2&count=:3', id => ({ id }));
    expect(merged.getState().graph.id).toBe(2);
    expect(merged.getState().count).toBe(3);

    const replaced = create('/review?count=:3', () => ({}) as Graph);
    expect(replaced.getState().graph).toEqual({});
    expect(replaced.getState().count).toBe(3);
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

  it('reads a plain object from another realm, as from an iframe, as a plain object', () => {
    const realm = createContext();
    const defaults = runInContext('({ status: "all" })', realm);
    const filtered = createStore<{ filter: { status: string } }>()(
      querystring(() => ({ filter: defaults }), {
        url: '/list?filter=.status=paid',
      }),
    );
    const selected = createStore<{
      filters: { search?: string; localSort: string };
    }>()(
      querystring(() => ({ filters: { search: 'acme', localSort: 'name' } }), {
        url: '/list?filters=.',
        select: () => runInContext('({ filters: { search: true } })', realm),
      }),
    );

    expect(filtered.getState().filter.status).toBe('paid');
    expect(filtered.getState().filter).not.toBe(defaults);
    expect(defaults.status).toBe('all');
    expect(selected.getState().filters).toStrictEqual({ localSort: 'name' });
  });
});

describe('href', () => {
  it('works on the server, with the url option', () => {
    const store = createStore<{ count: number; other: number }>()(
      querystring(() => ({ count: 0, other: 0 }), { url: '/a?count=:5' }),
    );

    expect(store.href('/b', { other: 0 })).toBe('/b');
    expect(decodeURIComponent(store.href('/b', { count: 0 }))).toBe(
      '/b?count=:0',
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

  it('with map, writes a passed key only when select keeps it', () => {
    const store = createStore<{ count: number; hidden: number }>()(
      querystring(() => ({ count: 0, hidden: 3 }), {
        url: '/results?n=:2',
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

  it('leaves a class instance state as it is, and writes the passed field', () => {
    class Filters {
      constructor(public status: string) {}
    }
    const store = createStore<Filters>()(
      querystring(() => new Filters('all'), { url: '/list' }),
    );

    expect(store.href('/list', { status: 'paid' })).toBe('/list?status=paid');
    expect(store.getState().status).toBe('all');
  });

  it('leaves a class instance whose field is an accessor as it is, and writes the passed field', () => {
    class Filter {
      storage = { status: 'all' };
      get status() {
        return this.storage.status;
      }
      set status(status: string) {
        this.storage.status = status;
      }
    }
    const store = createStore<{ status: string }>()(
      querystring(() => new Filter(), {
        url: '/list',
        select: () => ({ status: true }),
      }),
    );

    expect(store.href('/list', { status: 'paid' })).toBe('/list?status=paid');
    expect(store.getState().status).toBe('all');
  });

  it('writes a plain object passed for a class instance whose toJSON reads a private field', () => {
    class Filter {
      #unit = 'stars';
      rating = 0;
      toJSON() {
        return { rating: this.rating, unit: this.#unit };
      }
    }
    const create = (url?: string) =>
      createStore<{ filter: { rating: number } }>()(
        querystring(() => ({ filter: new Filter() }), { url, format: json }),
      );

    const href = create().href('/list', { filter: { rating: 2 } });
    expect(decodeURIComponent(href)).toBe('/list?filter={"rating":2}');
    expect(create(href).getState().filter.rating).toBe(2);
  });

  it('writes a plain object passed for a class instance field, which a new store merges into its instance', () => {
    class Filters {
      constructor(public status: string) {}
    }
    const create = (url: string) =>
      createStore<{ filters: Filters }>()(
        querystring(() => ({ filters: new Filters('all') }), { url }),
      );

    const href = create('/list').href('/list', { filters: { status: 'paid' } });
    expect(decodeURIComponent(href)).toBe('/list?filters=.status=paid');
    const opened = create(href).getState().filters;
    expect(opened).toBeInstanceOf(Filters);
    expect(opened.status).toBe('paid');
  });

  it('writes a field passed for a class instance the URL set at creation, and leaves the instance as it is', () => {
    class Filter {
      rating = 0;
    }
    const create = (url: string) =>
      createStore<{ filter: Filter }>()(
        querystring(() => ({ filter: new Filter() }), {
          url,
          select: () => ({ filter: { rating: true } }),
        }),
      );
    const store = create('/results?filter=.rating:4');

    const href = store.href('/results', { filter: { rating: 2 } });
    expect(decodeURIComponent(href)).toBe('/results?filter=.rating:2');
    expect(create(href).getState().filter.rating).toBe(2);
    expect(store.getState().filter.rating).toBe(4);
  });

  it('writes a class instance field the URL set at creation, when it is passed', () => {
    class Filter {
      rating = 0;
    }
    const create = (url: string) =>
      createStore<{ filter: Filter }>()(
        querystring(() => ({ filter: new Filter() }), {
          url,
          select: () => ({ filter: { rating: true } }),
        }),
      );
    const store = create('/results?filter=.rating:4');
    const four = Object.assign(new Filter(), { rating: 4 });

    const spread = store.href('/results', { ...store.getState() });
    expect(decodeURIComponent(spread)).toBe('/results?filter=.rating:4');
    expect(decodeURIComponent(store.href('/results', { filter: four }))).toBe(
      '/results?filter=.rating:4',
    );
    expect(create(spread).getState().filter.rating).toBe(4);
  });

  it('links from a class instance with a private field that the URL set at creation', () => {
    class Filter {
      #label = 'Rating';
      rating = 0;
      get label() {
        return this.#label;
      }
    }
    const store = createStore<{ rating: number; label: string }>()(
      querystring(() => new Filter(), {
        url: '/list?rating=:4',
        select: () => ({ rating: true, label: true }),
      }),
    );

    expect(store.getState().rating).toBe(4);
    expect(decodeURIComponent(store.href('/list', { rating: 2 }))).toBe(
      '/list?rating=:2',
    );
  });

  it('with a map, leaves out a value the format writes alike from two classes', () => {
    class ActiveSearch {
      constructor(public value: string) {}
    }
    class ArchivedSearch {
      constructor(public value: string) {}
    }
    const store = createStore<{ mode: string; search: string }>()(
      querystring(() => ({ mode: 'active', search: '' }), {
        url: '/results?search=.value=acme',
        map: {
          to: ({ mode, search }) => ({
            mode,
            search:
              mode === 'archived'
                ? new ArchivedSearch(search)
                : new ActiveSearch(search),
          }),
          from: ({ mode, search }) => ({
            mode: mode as string | undefined,
            search: (search as ActiveSearch | undefined)?.value,
          }),
        },
      }),
    );

    expect(store.getState().search).toBe('acme');
    expect(store.href('/results', { mode: 'archived' })).toBe(
      '/results?mode=archived',
    );
  });

  it('with a map, writes a passed value the format writes from a private field', () => {
    class SearchParam {
      #value: string;
      constructor(value: string) {
        this.#value = value;
      }
      toJSON() {
        return this.#value;
      }
    }
    const create = (url: string) =>
      createStore<{ search: string }>()(
        querystring(() => ({ search: '' }), {
          url,
          key: 'view',
          format: json,
          map: {
            to: ({ search }) => ({ search: new SearchParam(search) }),
            from: ({ search }) => ({ search: search as unknown as string }),
          },
        }),
      );

    const href = create('/results').href('/results', { search: 'acme' });
    expect(decodeURIComponent(href)).toBe('/results?view={"search":"acme"}');
    expect(create(href).getState().search).toBe('acme');
  });

  // A format whose text for a date needs the mode next to it.
  const needsMode = (state: object) => {
    if ('date' in state && !('mode' in state)) throw Error('date needs mode');
    return state;
  };
  it.each([
    [
      'writer',
      {
        ...marked,
        stringify: (state: object) => marked.stringify(needsMode(state)),
        stringifyStandalone: (state: object) =>
          marked.stringifyStandalone(needsMode(state)),
      },
    ],
    [
      'reader',
      {
        ...marked,
        parse: (value: string, ctx?: ParseContext) =>
          needsMode(marked.parse(value, ctx)),
        parseStandalone: (
          params: Record<string, string[]>,
          ctx: ParseContext,
        ) => needsMode(marked.parseStandalone(params, ctx)),
      },
    ],
  ])(
    'writes the passed fields to a format whose %s needs them together',
    (_, format) => {
      for (const [key, link] of [
        [false, '/list?mode=calendar&date=D1769904000000'],
        ['view', '/list?view=mode=calendar,date=D1769904000000'],
      ] as const) {
        const create = (url?: string) =>
          createStore<{ mode: string; date: Date }>()(
            querystring(
              () => ({ mode: 'compact', date: new Date('2026-01-01') }),
              { url, key, format },
            ),
          );

        const href = create().href('/list', {
          mode: 'calendar',
          date: new Date('2026-02-01'),
        });
        expect(href).toBe(link);
        expect(create(href).getState()).toStrictEqual({
          mode: 'calendar',
          date: new Date('2026-02-01'),
        });
      }
    },
  );

  it.each([
    [false, '/list?mode=paid&status=paid'],
    ['view', '/list?view=mode=paid,status=paid'],
  ] as const)(
    'with key %s, writes a passed class value and the field a format needs to agree with it',
    (key, link) => {
      class Status {
        #mode: string;
        constructor(mode: string) {
          this.#mode = mode;
        }
        mode() {
          return this.#mode;
        }
      }
      const encode = ({ status, ...state }: { status?: Status }) => {
        if (status && status.mode() !== (state as { mode?: string }).mode)
          throw Error('status needs matching mode');
        return status ? { ...state, status: status.mode() } : state;
      };
      const format = {
        ...marked,
        stringify: (state: object) => marked.stringify(encode(state)),
        stringifyStandalone: (state: object) =>
          marked.stringifyStandalone(encode(state)),
      };
      const create = (url?: string) =>
        createStore<{ mode: string; status: Status }>()(
          querystring(() => ({ mode: 'all', status: new Status('all') }), {
            url,
            key,
            format,
            map: {
              to: state => state,
              from: ({ mode, status }) => ({
                ...(mode ? { mode: mode as string } : {}),
                ...(status ? { status: new Status(status as string) } : {}),
              }),
            },
          }),
        );

      const href = create().href('/list', {
        mode: 'paid',
        status: new Status('paid'),
      });
      expect(decodeURIComponent(href)).toBe(link);
      expect(create(href).getState().status.mode()).toBe('paid');
    },
  );

  describe.each([
    [
      'marked',
      marked,
      ['/list?page=:2', '/list?view=page:2'],
      '/list?pageSize=:50',
    ],
    [
      'plain',
      plain,
      ['/list?page=2', '/list?view=page=2'],
      '/list?pageSize=50',
    ],
    [
      'json',
      json,
      ['/list?page=2', '/list?view={"page":2}'],
      '/list?pageSize=50',
    ],
  ] as const)(
    'with %s and a map that returns new class instances',
    (_, format, links, pageSizeLink) => {
      class Box {
        constructor(public value: unknown) {}
      }
      const create = <T extends object>(
        init: T,
        boxed: string,
        key: false | 'view',
      ) =>
        createStore<T>()(
          querystring(() => init, {
            url: '/list',
            key,
            format,
            map: {
              to: state => ({ ...state, [boxed]: new Box(state[boxed]) }),
              from: urlState =>
                Object.fromEntries(
                  Object.entries(urlState)
                    .filter(([, value]) => value !== undefined)
                    .map(([name, value]) => [
                      name,
                      name === boxed ? (value as Box).value : value,
                    ]),
                ) as Partial<T>,
            },
          }),
        );

      it.each([
        [false, links[0]],
        ['view', links[1]],
      ] as const)(
        'with key %s, leaves out a current value the link leaves as it is',
        (key, link) => {
          const store = create({ search: '', page: 1 }, 'search', key);
          store.setState({ search: 'acme' });

          expect(decodeURIComponent(store.href('/list', { page: 2 }))).toBe(
            link,
          );
        },
      );

      it('leaves out a key whose name starts the changed key', () => {
        const store = create({ page: 1, pageSize: 20 }, 'page', false);
        store.setState({ page: 3 });

        expect(store.href('/list', { pageSize: 50 })).toBe(pageSizeLink);
      });

      it('leaves out a key the format encodes in its param name', () => {
        const store = create({ 'my search': '', page: 1 }, 'my search', false);
        store.setState({ 'my search': 'acme' });

        expect(store.href('/list', { page: 2 })).toBe(links[0]);
      });
    },
  );

  it.each([
    [false, '/list?filter=.rating:0'],
    ['view', '/list?view=filter.rating:0'],
  ] as const)(
    'with key %s, writes a passed class value that another store changed in the instance this one holds',
    (key, link) => {
      class Filter {
        constructor(public rating = 0) {}
      }
      const shared = new Filter();
      const create = (filter: Filter, url = '/list') =>
        createStore<{ filter: Filter }>()(
          querystring(() => ({ filter }), { url, key }),
        );
      const store = create(shared);
      store.href('/list', { filter: new Filter(1) });
      create(
        shared,
        key ? '/list?view=filter.rating:4' : '/list?filter=.rating:4',
      );

      const href = store.href('/list', { filter: new Filter(0) });
      expect(decodeURIComponent(href)).toBe(link);
      expect(create(new Filter(8), href).getState().filter.rating).toBe(0);
    },
  );

  it('leaves out a passed class value in a nested field that equals the current and the initial one', () => {
    class Range {
      constructor(public max: number) {}
    }
    const store = createStore<{ filters: { price: Range; page: number } }>()(
      querystring(() => ({ filters: { price: new Range(100), page: 1 } }), {
        url: '/list',
      }),
    );

    expect(
      store.href('/list', { filters: { price: new Range(100), page: 2 } }),
    ).toBe('/list?filters=.page:2');
  });

  describe('with a class value a format writes from a private field', () => {
    class Id {
      #value: string;
      constructor(value: string) {
        this.#value = value;
      }
      toJSON() {
        return this.#value;
      }
    }
    const idOf = (state: object) => (state as { id?: Id }).id;
    const create = (format: QueryStringFormat, url?: string) =>
      createStore<{ id: Id }>()(
        querystring(() => ({ id: new Id('start') }), { url, format }),
      );

    it('writes a passed value to a format whose reader takes the values out of the params it gets', () => {
      // Writes the text of an id once and hands out the same array for it.
      const written = new Map<string, string[]>();
      const format = {
        ...json,
        stringifyStandalone: (state: object) => {
          const id = idOf(state);
          if (!id) return {};
          const text = encodeURIComponent(JSON.stringify(id));
          if (!written.has(text)) written.set(text, [text]);
          return { id: written.get(text)! };
        },
        parseStandalone: (params: Record<string, string[]>) => {
          const text = params.id?.shift();
          return text
            ? { id: new Id(JSON.parse(decodeURIComponent(text))) }
            : {};
        },
      };

      const href = create(format).href('/list', { id: new Id('next') });
      expect(href).toBe('/list?id=%22next%22');
      expect(create(format, href).getState().id.toJSON()).toBe('next');
    });

    it("writes a passed value when the current ones are values the format's reader rejects", () => {
      const format = {
        ...json,
        parseStandalone: (
          params: Record<string, string[]>,
          ctx: ParseContext,
        ) => {
          const state = json.parseStandalone(params, ctx);
          if (Object.values(state).includes('')) throw Error('empty id');
          return state;
        },
      };
      const create = (url?: string) =>
        createStore<{ id: Id; parent: Id }>()(
          querystring(() => ({ id: new Id(''), parent: new Id('') }), {
            url,
            format,
          }),
        );

      const href = create().href('/list', { id: new Id('42') });
      expect(href).toBe('/list?id=%2242%22');
      expect(create(href).getState().id).toBe('42');
    });

    it('writes a passed value with a #, which the URL escapes for the reader', () => {
      const format = {
        ...json,
        stringifyStandalone: (state: object) => {
          const id = idOf(state);
          return id ? { id: [JSON.stringify(id)] } : {};
        },
        parseStandalone: (params: Record<string, string[]>) => {
          const [text] = params.id ?? [];
          if (text === undefined) return {};
          if (text.includes('#')) throw Error('expected an escaped #');
          return { id: new Id(JSON.parse(decodeURIComponent(text))) };
        },
      };

      const href = create(format).href('/list', { id: new Id('a#b') });
      expect(href).toBe('/list?id=%22a%23b%22');
      expect(create(format, href).getState().id.toJSON()).toBe('a#b');
    });
  });

  it('with a map that returns new class instances, writes the current and the initial state once', () => {
    class Box {
      constructor(public value: string) {}
    }
    let writes = 0;
    const store = createStore<{ search: string; page: number }>()(
      querystring(() => ({ search: '', page: 1 }), {
        url: '/list',
        format: {
          ...marked,
          stringifyStandalone: (state: object) => {
            writes++;
            return marked.stringifyStandalone(state);
          },
        },
        map: {
          to: ({ search, page }) => ({ search: new Box(search), page }),
          from: ({ search, page }) => ({
            ...(search ? { search: (search as Box).value } : {}),
            ...(page === undefined ? {} : { page: page as number }),
          }),
        },
      }),
    );
    store.setState({ search: 'acme' });

    const counts = [2, 3].map(page => {
      writes = 0;
      expect(store.href('/list', { page })).toBe(`/list?page=:${page}`);
      return writes;
    });
    expect(counts).toStrictEqual([5, 3]);
  });

  it.each([
    [false, '/list?color=.value=red&size=.value=red&page=:3', 1, 2],
    ['view', '/list?view=color.value=red~,size.value=red~,page:3', 1, 1],
  ] as const)(
    'with key %s and a map that returns new class instances, writes a link that carries the current view once and reads only the params it changes',
    (key, link, writes, reads) => {
      class Facet {
        constructor(public value: string) {}
      }
      const counts = { writes: 0, reads: 0 };
      const count =
        <A extends unknown[], R>(
          name: keyof typeof counts,
          fn: (...args: A) => R,
          params: (...args: A) => number,
        ) =>
        (...args: A) => {
          counts[name] += params(...args);
          return fn(...args);
        };
      const store = createStore<{
        color: string;
        size: string;
        page: number;
      }>()(
        querystring(() => ({ color: 'all', size: 'all', page: 1 }), {
          url: '/list',
          key,
          format: {
            stringify: count('writes', marked.stringify, () => 1),
            parse: count('reads', marked.parse, () => 1),
            stringifyStandalone: count(
              'writes',
              marked.stringifyStandalone,
              () => 1,
            ),
            parseStandalone: count(
              'reads',
              marked.parseStandalone,
              params => Object.keys(params).length,
            ),
          },
          map: {
            to: ({ color, size, page }) => ({
              color: new Facet(color),
              size: new Facet(size),
              page,
            }),
            from: ({ color, size, page }) => ({
              ...(color ? { color: (color as Facet).value } : {}),
              ...(size ? { size: (size as Facet).value } : {}),
              ...(page === undefined ? {} : { page: page as number }),
            }),
          },
        }),
      );
      store.setState({ color: 'red', size: 'red' });
      store.href('/list', { ...store.getState(), page: 2 });
      counts.writes = counts.reads = 0;

      expect(
        decodeURIComponent(
          store.href('/list', { ...store.getState(), page: 3 }),
        ),
      ).toBe(link);
      expect(counts).toStrictEqual({ writes, reads });
    },
  );

  it("with a map that returns new class instances, leaves out a current value when the format's reader rejects the changed param alone", () => {
    class Box {
      constructor(public value: string) {}
    }
    const store = createStore<{ mode: string; date: Date; search: string }>()(
      querystring(
        () => ({ mode: 'calendar', date: new Date('2026-01-01'), search: '' }),
        {
          url: '/list',
          format: {
            ...marked,
            parseStandalone: (params, ctx) =>
              needsMode(marked.parseStandalone(params, ctx)),
          },
          map: {
            to: ({ search, ...state }) => ({
              ...state,
              search: new Box(search),
            }),
            from: ({ search, ...state }) => ({
              ...state,
              ...(search ? { search: (search as Box).value } : {}),
            }),
          },
        },
      ),
    );
    store.setState({ search: 'acme' });

    expect(store.href('/list', { date: new Date('2026-02-01') })).toBe(
      '/list?date=D1769904000000',
    );
  });

  it('with a map that returns new class instances, writes a link that passes nothing once', () => {
    class Facet {
      constructor(public value: string) {}
    }
    const names = ['color', 'size', 'brand', 'price'];
    let writes = 0;
    const store = createStore<{
      values: Record<string, string>;
      open: boolean;
    }>()(
      querystring(
        () => ({
          values: Object.fromEntries(names.map(name => [name, 'all'])),
          open: false,
        }),
        {
          url: '/collection',
          format: {
            ...marked,
            stringifyStandalone: (state: object) => {
              writes++;
              return marked.stringifyStandalone(state);
            },
          },
          map: {
            to: ({ values }) =>
              Object.fromEntries(
                names.map(name => [name, new Facet(values[name])]),
              ),
            from: urlState => ({
              values: Object.fromEntries(
                Object.entries(urlState).map(([name, facet]) => [
                  name,
                  (facet as Facet).value,
                ]),
              ),
            }),
          },
        },
      ),
    );
    store.setState({ open: true });
    writes = 0;

    expect(store.href('/collection/1')).toBe('/collection/1');
    expect(writes).toBe(1);
  });

  it.each([
    [false, '/list?date=2026-02-01T00:00:00.000Z'],
    ['view', '/list?view=date=2026-02-01T00:00:00.000Z'],
  ] as const)(
    'with key %s, writes the values the map returns to a format that encodes them',
    (key, link) => {
      // Writes a date as its ISO text, which map.from turns back into a date.
      const encode = (state: { date?: Date }) =>
        state.date ? { date: state.date.toISOString() } : state;
      const format = {
        ...marked,
        stringify: (state: object) => marked.stringify(encode(state)),
        stringifyStandalone: (state: object) =>
          marked.stringifyStandalone(encode(state)),
      };
      const create = (url?: string) =>
        createStore<{ date: Date }>()(
          querystring(() => ({ date: new Date('2026-01-01') }), {
            url,
            key,
            format,
            map: {
              to: ({ date }) => ({ date }),
              from: ({ date }) =>
                date === undefined ? {} : { date: new Date(date as string) },
            },
          }),
        );

      const href = create().href('/list', { date: new Date('2026-02-01') });
      expect(href).toBe(link);
      expect(create(href).getState().date).toStrictEqual(
        new Date('2026-02-01'),
      );
    },
  );

  it('writes a passed nested undefined, with syncUndefined', () => {
    const create = (url: string) =>
      createStore<{ filters: { region: string; tag?: string } }>()(
        querystring(() => ({ filters: { region: 'EU' } }), {
          url,
          format: plain,
          syncUndefined: true,
        }),
      );

    const href = create('/results').href('/results', {
      filters: { tag: undefined },
    });
    expect(href).toBe('/results?filters.tag=undefined');
    expect(create(href).getState()).toStrictEqual({
      filters: { region: 'EU', tag: undefined },
    });
  });

  it.each([null, undefined])(
    'leaves out the %s a map writes, without syncNull and syncUndefined',
    empty => {
      const store = createStore<{ mode: string; page: number | null }>()(
        querystring(() => ({ mode: 'visible', page: 1 }), {
          url: '/list',
          map: {
            to: ({ mode, page }) => ({
              page: mode === 'hidden' ? empty : page,
            }),
            from: ({ page }) => ({ page: page as number }),
          },
        }),
      );
      store.setState({ mode: 'hidden', page: 3 });

      expect(store.href('/list', { page: 2 })).toBe('/list');
    },
  );

  it.each([
    ['with url', { url: '/list' }],
    ['without url', {}],
  ] as const)('%s: works inside the initializer', (_, options) => {
    const store = createStore<{ status: string; paidHref: string }>()(
      querystring(
        (_set, _get, api) => ({
          status: 'all',
          paidHref: api.href('/list', { status: 'paid' }),
        }),
        options,
      ),
    );

    expect(store.getState().paidHref).toBe('/list?status=paid');
  });

  it('leaves out nested null and undefined, without syncNull and syncUndefined', () => {
    const store = createStore<{ inner: { v: string | null; w?: string } }>()(
      querystring(() => ({ inner: { v: 'x', w: 'x' } }), { url: '/a' }),
    );

    expect(store.href('/b', { inner: { v: null, w: undefined } })).toBe('/b');
  });

  it('leaves out a passed object none of whose fields select syncs, so its link keeps them', () => {
    const create = (url?: string) =>
      createStore<{ filters: { shown?: string; localSort: string } }>()(
        querystring(
          () => ({ filters: { shown: 'open', localSort: 'oldest' } }),
          { url, select: () => ({ filters: { shown: true } }) },
        ),
      );

    const href = create('/review').href('/report', {
      filters: { localSort: 'newest' },
    });
    expect(href).toBe('/report');
    expect(create(href).getState()).toStrictEqual({
      filters: { shown: 'open', localSort: 'oldest' },
    });
    expect(create('/review').href('/report', { filters: {} })).toBe(
      '/report?filters=.',
    );
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
    expect(store.href('/review', { filters: {} })).toBe('/review');
    store.setState({ filters: { hidden: 'internal' } });
    expect(store.href('/review')).toBe('/review');
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
    const create = (options: { url?: string }) =>
      createStore<{ view: string }>()(
        querystring((_set, _get, api) => {
          api.setDefaults({ view: 'list' });
          return { view: 'grid' };
        }, options),
      );
    const store = create(options);

    expect(store.getState().view).toBe('grid');
    store.setState({ view: 'list' });
    const href = store.href('/review', { view: 'list' });
    expect(href).toBe('/review?view=list');
    expect(create({ url: href }).getState().view).toBe('list');
  });
});

describe("server store (url option): a parameter the format can't read", () => {
  it.each([
    [
      'marked',
      '/?count=:5&utm_content=50%off',
      {},
      { utm_content: '50%off' },
      marked,
    ],
    [
      'plain',
      '/?count=5&utm_content=50%off',
      {},
      { utm_content: '50%off' },
      plain,
    ],
    ['json', '/?count=5&utm_content=50%off', {}, {}, json],
    ['marked', '/?count=:5&50%off=1', {}, { '50%off': '1' }, marked],
    [
      'marked',
      '/?count=:5&next=./sale/50%off',
      {},
      { next: './sale/50%off' },
      marked,
    ],
    ['marked', '/?count=:5&ext=.png', {}, { ext: '.png' }, marked],
    [
      'marked',
      '/?count=:5&toString=./sale',
      {},
      { toString: './sale' },
      marked,
    ],
    ['marked', '/?count=:5&ext=.png', { ext: null }, { ext: '.png' }, marked],
  ] as const)(
    '%s: %s still restores count (initial %o)',
    (_, url, initial, expected, format) => {
      const store = createStore(
        querystring(() => ({ count: 0, ...initial }), {
          url,
          key: false,
          format,
        }),
      );
      expect(store.getState()).toStrictEqual({ count: 5, ...expected });
    },
  );

  it.each([
    ['/?count=5&a=1&a.b=2', 1],
    ['/?count=5&a=red&a=blue&a.0=9', ['red', 'blue']],
    ['/?count=5&a.0=9&a=red&a=blue', ['red', 'blue']],
    ['/?count=5&a=undefined&a.b=2', undefined],
    ['/?count=5&a=red&a=blue&a.length=oops', ['red', 'blue']],
    ['/?count=5&a.length=oops&a=red&a=blue', ['red', 'blue']],
  ])('plain: %s keeps a as the shorter path set it', (url, a) => {
    const store = createStore(
      querystring(() => ({ count: 0 }), {
        url,
        key: false,
        format: plain,
        syncUndefined: true,
      }),
    );
    expect(store.getState()).toStrictEqual({ count: 5, a });
  });

  it('plain: /?count=5&x_=1&x__=2 reads the later spelling of x_', () => {
    const store = createStore(
      querystring(() => ({ count: 0, x_: '' }), {
        url: '/?count=5&x_=1&x__=2',
        key: false,
        format: plain,
      }),
    );
    expect(store.getState()).toStrictEqual({ count: 5, x_: '2' });
  });

  it.each([
    ['/?s_count=5&s_a.comment=promo', ['keep']],
    ['/?s_count=5&s_a.0.tags.length=oops', [{ tags: ['keep'] }]],
  ])('plain: %s leaves the default of a dropped path', (url, a) => {
    const store = createStore(
      querystring(() => ({ count: 0, a }), {
        url,
        key: false,
        prefix: 's_',
        format: plain,
      }),
    );
    expect(store.getState()).toStrictEqual({ count: 5, a });
  });

  describe.each([false, 'state'] as const)('plain (key: %s)', key => {
    const urlOf = (entries: string[]) =>
      key
        ? `/?s_state=${['count=5', ...entries].join(',')}`
        : `/?${['count=5', ...entries].map(e => `s_${e}`).join('&')}`;

    it.each([
      [{ a: {} }, ['a.0.title=book'], { a: [{ title: 'book' }] }],
      [{}, ['f.0=red', 'f.color=blue'], { f: { 0: 'red', color: 'blue' } }],
      [
        { filters: {} },
        ['filters.0=red', 'filters.all=blue'],
        { filters: { 0: 'red', all: 'blue' } },
      ],
      [{ selected: {} }, ['selected.42=true'], { selected: { 42: true } }],
      [{ sel: {} }, ['sel.007=x'], { sel: { '007': 'x' } }],
      [{}, ['f.1=red'], { f: [, 'red'] }],
      [{ tags: [] }, ['tags.0=a', 'tags.x=b'], { tags: ['a'] }],
      [
        { a: {} },
        ['a.0.title=book', 'a.1.title=pen'],
        { a: [{ title: 'book' }, { title: 'pen' }] },
      ],
      [{}, ['f.0=a', 'f._x=b'], { f: { 0: 'a', _x: 'b' } }],
      [
        { sel: {} },
        ['sel.00=a', 'sel.01=b'],
        { sel: { '00': 'a', '01': 'b' } },
      ],
      [{}, ['a.01.x=1'], { a: [, { x: 1 }] }],
      [{}, ['a.toString.x=1'], { a: { toString: { x: 1 } } }],
    ])(
      '%o reads %o as a container of the right kind',
      (initial, entries, expected) => {
        const store = createStore(
          querystring(() => ({ count: 0, ...initial }), {
            url: urlOf(entries),
            key,
            prefix: 's_',
            format: plain,
          }),
        );
        expect(store.getState()).toStrictEqual({ count: 5, ...expected });
      },
    );

    it('reads constructor.prototype.polluted=yes as data, not into Object.prototype', () => {
      const store = createStore(
        querystring(() => ({ count: 0 }), {
          url: urlOf(['constructor.prototype.polluted=yes']),
          key,
          prefix: 's_',
          format: plain,
        }),
      );
      expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
      // toStrictEqual compares constructors, so the own constructor key is checked apart
      const { constructor, ...rest } = store.getState();
      expect(rest).toStrictEqual({ count: 5 });
      expect(constructor).toStrictEqual({ prototype: { polluted: 'yes' } });
    });

    it.each([
      [{}, ['hasOwnProperty.call=1'], { hasOwnProperty: { call: 1 } }],
      [{ tags: [] }, ['tags.constructor.prototype.x=1'], { tags: [] }],
      [{ tags: [] }, ['tags.___proto____.x=1'], { tags: [] }],
    ])(
      '%o reads %o without changing a prototype',
      (initial, entries, expected) => {
        try {
          const store = createStore(
            querystring(() => ({ count: 0, ...initial }), {
              url: urlOf(entries),
              key,
              prefix: 's_',
              format: plain,
            }),
          );
          expect(({} as { x?: unknown }).x).toBeUndefined();
          expect(([] as { x?: unknown }).x).toBeUndefined();
          expect(Object.prototype.hasOwnProperty.call).toBe(
            Function.prototype.call,
          );
          expect(store.getState()).toStrictEqual({ count: 5, ...expected });
        } finally {
          delete (Object.prototype as { x?: unknown }).x;
          delete (Array.prototype as { x?: unknown }).x;
          delete (Object.prototype.hasOwnProperty as { call?: unknown }).call;
        }
      },
    );
  });

  it.each([
    ['/?count=:5&filters=.status', { filters: { status: 'all' } }],
    ['/?count=:5&page=.png', { page: 1 }],
    ['/?count=:5&on=.png', { on: true }],
    ['/?count=:5&page=:90abc', { page: 1 }],
    ['/?count=:5&page=:90,%20off%', { page: 1 }],
  ])('marked: %s keeps the default of a non-string field', (url, initial) => {
    const store = createStore(
      querystring(() => ({ count: 0, ...initial }), {
        url,
        key: false,
        format: marked,
      }),
    );
    expect(store.getState()).toStrictEqual({ count: 5, ...initial });
  });

  it('marked: a typed map never sees the text of a number field', () => {
    const map = createMap({
      to: ({ page, count }: { page: number; count: number }) => ({
        page,
        count,
      }),
      from: ({ page, count }) => ({
        page: page === undefined ? undefined : Number(page.toFixed(0)),
        count,
      }),
    });
    const store = createStore(
      querystring(() => ({ count: 0, page: 1 }), {
        url: '/?count=:5&page=.png',
        key: false,
        format: marked,
        map,
      }),
    );
    expect(store.getState()).toStrictEqual({ count: 5, page: 1 });
  });

  it.each([
    ['marked', '/?count=:5&q=50%%20off', false, '50% off', marked],
    ['plain', '/?count=5&q=50%%20off', false, '50% off', plain],
    ['marked', '/?count=:5&q=caf%C3%A9%20100%', false, 'café 100%', marked],
    ['marked', '/?count=:5&q=./sale/50%off', false, './sale/50%off', marked],
    ['marked', '/?count=:5&q=%41%E2%25', false, 'A%E2%', marked],
    ['marked', '/?count=:5&q=:90%', false, ':90%', marked],
    ['marked', '/?count=:5&q=:90,%20off%', false, ':90, off%', marked],
    ['plain', '/?count=5&q=%41%E2%25', false, 'A%E2%', plain],
    ['plain', '/?count=5&q=%C0%AF%41%', false, '%C0%AFA%', plain],
    ['json', '/?count=5&q=%22100%%22', false, '100%', json],
    [
      'json',
      '/?state=%7B%22count%22:5,%22q%22:%22bad%E2%22%7D',
      'state',
      'bad%E2',
      json,
    ],
    [
      'json',
      '/?state=%7B%22count%22:5,%22q%22:%22100%%22%7D',
      'state',
      '100%',
      json,
    ],
    [
      'marked',
      '/?state=count:5,q=John%20Doe%20100%',
      'state',
      'John Doe 100%',
      marked,
    ],
    [
      'plain',
      '/?state=count=5,q=John%20Doe%20100%',
      'state',
      'John Doe 100%',
      plain,
    ],
  ] as const)('%s: %s decodes the valid escapes', (_, url, key, q, format) => {
    const store = createStore(
      querystring(() => ({ count: 0, q: '' }), { url, key, format }),
    );
    expect(store.getState()).toEqual({ count: 5, q });
  });

  it.each([
    ['/?state=count:5abc,q=x', { count: 0, q: 'x' }],
    ['/?state=count:5,ids@:1,:2x,:3', { count: 5, q: '', ids: [1, 3] }],
  ])('marked: %s skips only the unreadable number', (url, expected) => {
    const store = createStore(
      querystring(() => ({ count: 0, q: '' }), {
        url,
        key: 'state',
        format: marked,
      }),
    );
    expect(store.getState()).toStrictEqual(expected);
  });
});

describe('server store (url option): a plain array index', () => {
  it.each([
    [{ tags: ['a'] }, '/?count=5&tags.4294967294=z', { tags: ['a'] }],
    [{ tags: ['a'] }, '/?count=5&tags.30000000=z', { tags: ['a'] }],
    [{ tags: ['a'] }, '/?count=5&tags.1=b&tags.0=a', { tags: ['a', 'b'] }],
    [{ tags: ['a'] }, '/?count=5&tags.4294967294.x=z', { tags: ['a'] }],
    [
      { tags: ['a'] },
      '/?count=5&a.9000=x&tags.9000=z',
      { a: expect.any(Array), tags: ['a'] },
    ],
    [
      {},
      '/?count=5&a.9000=x&k0.9000=y',
      { a: expect.any(Array), k0: { 9000: 'y' } },
    ],
    [
      { items: [] },
      `/?count=5&${Array.from({ length: 150 }, (_, i) => `items.${i}.n=${i}`).join('&')}`,
      { items: Array.from({ length: 150 }, (_, i) => ({ n: i })) },
    ],
    [
      { cols: [] },
      '/?count=5&cols.22.width=120',
      { cols: [...new Array(22), { width: 120 }] },
    ],
    [
      {},
      '/?count=5&cols.22.width=120',
      { cols: [...new Array(22), { width: 120 }] },
    ],
    [
      { sel: {} },
      '/?count=5&sel.007=true&sel.7=false',
      { sel: { '007': true, 7: false } },
    ],
    [
      { selected: {} },
      '/?count=5&selected.1234567890123456789=true',
      { selected: { '1234567890123456789': true } },
    ],
    [{}, '/?count=5&byId.20000.n=5', { byId: { 20000: { n: 5 } } }],
    [
      {},
      '/?count=5&byId.1.n=1&byId.4294967294.n=5',
      { byId: { 1: { n: 1 }, 4294967294: { n: 5 } } },
    ],
  ])('initial %o: %s', (initial, url, expected) => {
    const store = createStore(
      querystring(() => ({ count: 0, ...initial }), {
        url,
        key: false,
        format: plain,
      }),
    );
    expect(store.getState()).toEqual({ count: 5, ...expected });
  });
});

describe('server store (url option): a key naming an Object member keeps the rest of the URL', () => {
  const formats = { marked, plain, json };
  it.each([
    ['marked', false, '/?count=:5&toString=1'],
    ['plain', 'state', '/?state=constructor=1,count=5,toString=1'],
    ['marked', false, '/?count=:5&__proto__=.polluted=yes'],
    ['marked', false, '/?count=:5&%5F%5Fproto%5F%5F=.polluted=yes'],
    ['json', false, '/?count=5&__proto__=%7B%22polluted%22:%22yes%22%7D'],
  ] as const)('%s, key %s: %s', (format, key, url) => {
    const store = createStore(
      querystring(() => ({ count: 0 }), {
        url,
        key,
        format: formats[format],
      }),
    );
    const state = store.getState() as { count: number; polluted?: string };
    expect(state.count).toBe(5);
    expect(state.polluted).toBeUndefined();
    // zustand copies the state into a new object on each update
    store.setState({ count: 6 });
    expect(
      (store.getState() as { polluted?: string }).polluted,
    ).toBeUndefined();
  });

  it.each([
    [{ key: false }, '/?count=5&__proto__=x'],
    [{ key: false, prefix: 'p_' }, '/?p_count=5&p___proto__=x'],
    [{ key: 'state' }, '/?state=count=5,__proto__=x'],
  ] as const)('plain, %o: %s keeps __proto__ as data', (options, url) => {
    const store = createStore(
      querystring(() => ({ count: 0 }), { ...options, url, format: plain }),
    );
    // A trailing __ is plain's escaped _
    expect(store.getState()).toEqual({ count: 5, __proto_: 'x' });
  });
});
