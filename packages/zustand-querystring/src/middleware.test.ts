import { describe, it, expect } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { compact, createMap, querystring } from './middleware';
import { marked } from './format/marked';
import { plain } from './format/plain';
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
    ['/?count=5&a.0=red&a.length=oops', ['red']],
  ])('plain: %s keeps a as the shorter path set it', (url, a) => {
    const store = createStore(
      querystring(() => ({ count: 0 }), { url, key: false, format: plain }),
    );
    expect(store.getState()).toStrictEqual({ count: 5, a });
  });

  it.each([
    ['/?s_count=5&s_filters.0=red&s_filters.all=blue', false],
    ['/?s_state=count=5,filters.0=red,filters.all=blue', 'state'],
  ] as const)(
    'plain: %s keeps numeric keys under an object default',
    (url, key) => {
      const store = createStore(
        querystring(() => ({ count: 0, filters: {} }), {
          url,
          key,
          prefix: 's_',
          format: plain,
        }),
      );
      expect(store.getState()).toStrictEqual({
        count: 5,
        filters: { 0: 'red', all: 'blue' },
      });
    },
  );

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
