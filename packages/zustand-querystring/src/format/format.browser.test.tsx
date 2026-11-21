/**
 * Comprehensive Browser Tests for URL State Serialization
 *
 * These tests verify the full round-trip: state → URL → page refresh → state
 * with complex state objects that exercise all parser branches.
 *
 * Test matrix:
 * - Formats: marked, plain
 * - Modes: standalone (key: false), namespaced (key: string)
 * - Configurations: default, custom options
 * - State types: strings, numbers, booleans, null, arrays, nested objects, dates
 * - Edge cases: special characters, unicode, empty values, escape sequences
 */
import { StrictMode, useState } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { create } from 'zustand';
import { querystring, createMap } from '../middleware.js';
import type { QueryStringOptions } from '../middleware.js';
import { marked, createFormat as createMarkedFormat } from './marked.js';
import { json } from './json.js';
import { plain, createFormat as createPlainFormat } from './plain.js';
import type { MarkedFormatOptions } from './marked.js';
import type { PlainFormatOptions } from './plain.js';

// =============================================================================
// COMPLEX STATE TYPES
// =============================================================================

interface ComplexState {
  // Primitives
  search: string;
  count: number;
  price: number;
  active: boolean;
  verified: boolean;
  nothing: null;

  // Arrays
  tags: string[];
  scores: number[];
  flags: boolean[];

  // Nested objects
  user: {
    name: string;
    age: number;
    email: string;
    settings: {
      theme: string;
      notifications: boolean;
      limits: {
        daily: number;
        monthly: number;
      };
    };
  };

  // Array of objects
  items: Array<{
    id: number;
    name: string;
    active: boolean;
  }>;

  // Date
  created: Date;

  // Actions (excluded from serialization)
  setSearch: (search: string) => void;
  setCount: (count: number) => void;
  setAll: (state: Partial<ComplexState>) => void;
  reset: () => void;
}

const initialComplexState = {
  search: '',
  count: 0,
  price: 0,
  active: false,
  verified: false,
  nothing: null,
  tags: [],
  scores: [],
  flags: [],
  user: {
    name: '',
    age: 0,
    email: '',
    settings: {
      theme: 'light',
      notifications: true,
      limits: {
        daily: 100,
        monthly: 1000,
      },
    },
  },
  items: [],
  created: new Date(0),
};

const complexTestState = {
  search: 'hello, world',
  count: 42,
  price: 99.99,
  active: true,
  verified: false,
  nothing: null,
  tags: ['typescript', 'react', 'zustand'],
  scores: [100, 85, 92],
  flags: [true, false, true],
  user: {
    name: 'John Doe',
    age: 30,
    email: 'john@example.com',
    settings: {
      theme: 'dark',
      notifications: false,
      limits: {
        daily: 500,
        monthly: 5000,
      },
    },
  },
  items: [
    { id: 1, name: 'Item A', active: true },
    { id: 2, name: 'Item B', active: false },
  ],
  created: new Date('2024-06-15T12:00:00.000Z'),
};

// State with special characters that test escaping
const specialCharsState = {
  search: 'test.@=:,~/value',
  count: 42,
  price: 3.14,
  active: true,
  verified: true,
  nothing: null,
  tags: ['tag.with.dots', 'tag,with,commas', 'tag~with~tildes'],
  scores: [1, 2, 3],
  flags: [true],
  user: {
    name: 'José García',
    age: 25,
    email: 'josé@例え.com',
    settings: {
      theme: 'dark/light',
      notifications: true,
      limits: {
        daily: 100,
        monthly: 1000,
      },
    },
  },
  items: [{ id: 1, name: 'Item=1', active: true }],
  created: new Date('2024-01-01T00:00:00.000Z'),
};

// Unicode state
const unicodeState = {
  search: '你好世界 👋🌍 café',
  count: 0,
  price: 0,
  active: false,
  verified: false,
  nothing: null,
  tags: ['日本語', 'العربية', '한국어'],
  scores: [],
  flags: [],
  user: {
    name: 'Müller',
    age: 0,
    email: 'test@example.com',
    settings: {
      theme: 'default',
      notifications: true,
      limits: {
        daily: 0,
        monthly: 0,
      },
    },
  },
  items: [],
  created: new Date(0),
};

// Clean up URL before each test.
// The 150ms delay lets the writes previous stores owe 100ms after a navigation drain
// so they don't corrupt the next test's URL.
beforeEach(async () => {
  await new Promise(r => setTimeout(r, 150));
  window.history.replaceState({}, '', window.location.pathname);
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createComplexStore(format: any, key: string | false) {
  return create<ComplexState>()(
    querystring(
      set => ({
        ...initialComplexState,
        setSearch: search => set({ search }),
        setCount: count => set({ count }),
        setAll: state => set(state),
        reset: () => set(initialComplexState),
      }),
      { key, format },
    ),
  );
}

function ComplexStateDisplay({
  store,
}: {
  store: ReturnType<typeof createComplexStore>;
}) {
  const state = store();
  return (
    <div>
      <span data-testid="search">{state.search}</span>
      <span data-testid="count">{state.count}</span>
      <span data-testid="count-type">{typeof state.count}</span>
      <span data-testid="price">{state.price}</span>
      <span data-testid="price-type">{typeof state.price}</span>
      <span data-testid="active">{String(state.active)}</span>
      <span data-testid="active-type">{typeof state.active}</span>
      <span data-testid="verified">{String(state.verified)}</span>
      <span data-testid="nothing">
        {state.nothing === null ? 'null' : 'not-null'}
      </span>
      <span data-testid="tags">{JSON.stringify(state.tags)}</span>
      <span data-testid="scores">{JSON.stringify(state.scores)}</span>
      <span data-testid="scores-types">
        {state.scores.map(s => typeof s).join(',')}
      </span>
      <span data-testid="flags">{JSON.stringify(state.flags)}</span>
      <span data-testid="flags-types">
        {state.flags.map(f => typeof f).join(',')}
      </span>
      <span data-testid="user-name">{state.user.name}</span>
      <span data-testid="user-age">{state.user.age}</span>
      <span data-testid="user-age-type">{typeof state.user.age}</span>
      <span data-testid="user-email">{state.user.email}</span>
      <span data-testid="user-theme">{state.user.settings.theme}</span>
      <span data-testid="user-notifications">
        {String(state.user.settings.notifications)}
      </span>
      <span data-testid="user-daily">{state.user.settings.limits.daily}</span>
      <span data-testid="user-monthly">
        {state.user.settings.limits.monthly}
      </span>
      <span data-testid="items">{JSON.stringify(state.items)}</span>
      <span data-testid="items-length">{state.items.length}</span>
      <span data-testid="created">{state.created.getTime()}</span>
      <span data-testid="created-is-date">
        {String(state.created instanceof Date)}
      </span>
      <button onClick={() => state.setAll(complexTestState as any)}>
        Set Complex
      </button>
      <button onClick={() => state.setAll(specialCharsState as any)}>
        Set Special
      </button>
      <button onClick={() => state.setAll(unicodeState as any)}>
        Set Unicode
      </button>
    </div>
  );
}

// =============================================================================
// MARKED FORMAT TESTS
// =============================================================================

describe('Marked Format - Comprehensive Browser Tests', () => {
  describe('standalone mode (key: false)', () => {
    describe('default configuration', () => {
      it('should round-trip complex state with all types', async () => {
        const useStore = createComplexStore(marked, false);

        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Complex' }).click();

        // Verify all values
        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect
          .element(page.getByTestId('count-type'))
          .toHaveTextContent('number');
        await expect
          .element(page.getByTestId('price'))
          .toHaveTextContent('99.99');
        await expect
          .element(page.getByTestId('price-type'))
          .toHaveTextContent('number');
        await expect
          .element(page.getByTestId('active'))
          .toHaveTextContent('true');
        await expect
          .element(page.getByTestId('active-type'))
          .toHaveTextContent('boolean');
        await expect
          .element(page.getByTestId('verified'))
          .toHaveTextContent('false');
        await expect
          .element(page.getByTestId('nothing'))
          .toHaveTextContent('null');
        await expect
          .element(page.getByTestId('tags'))
          .toHaveTextContent('["typescript","react","zustand"]');
        await expect
          .element(page.getByTestId('scores'))
          .toHaveTextContent('[100,85,92]');
        await expect
          .element(page.getByTestId('scores-types'))
          .toHaveTextContent('number,number,number');
        await expect
          .element(page.getByTestId('flags'))
          .toHaveTextContent('[true,false,true]');
        await expect
          .element(page.getByTestId('flags-types'))
          .toHaveTextContent('boolean,boolean,boolean');
        await expect
          .element(page.getByTestId('user-name'))
          .toHaveTextContent('John Doe');
        await expect
          .element(page.getByTestId('user-age'))
          .toHaveTextContent('30');
        await expect
          .element(page.getByTestId('user-age-type'))
          .toHaveTextContent('number');
        await expect
          .element(page.getByTestId('user-theme'))
          .toHaveTextContent('dark');
        await expect
          .element(page.getByTestId('user-notifications'))
          .toHaveTextContent('false');
        await expect
          .element(page.getByTestId('user-daily'))
          .toHaveTextContent('500');
        await expect
          .element(page.getByTestId('user-monthly'))
          .toHaveTextContent('5000');
        await expect
          .element(page.getByTestId('items-length'))
          .toHaveTextContent('2');
        await expect
          .element(page.getByTestId('created-is-date'))
          .toHaveTextContent('true');
      });

      it('should round-trip state with special characters', async () => {
        const useStore = createComplexStore(marked, false);

        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Special' }).click();

        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('test.@=:,~/value');
        await expect
          .element(page.getByTestId('tags'))
          .toHaveTextContent(
            '["tag.with.dots","tag,with,commas","tag~with~tildes"]',
          );
        await expect
          .element(page.getByTestId('user-name'))
          .toHaveTextContent('José García');
        await expect
          .element(page.getByTestId('user-theme'))
          .toHaveTextContent('dark/light');
      });

      it('should round-trip unicode characters', async () => {
        const useStore = createComplexStore(marked, false);

        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Unicode' }).click();

        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('你好世界 👋🌍 café');
        await expect
          .element(page.getByTestId('tags'))
          .toHaveTextContent('["日本語","العربية","한국어"]');
        await expect
          .element(page.getByTestId('user-name'))
          .toHaveTextContent('Müller');
      });

      it('should restore complex state from URL on mount', async () => {
        // Pre-set URL with encoded state
        const params = marked.stringifyStandalone(complexTestState);
        const urlParts: string[] = [];
        for (const [key, values] of Object.entries(params)) {
          for (const value of values) {
            urlParts.push(`${key}=${value}`);
          }
        }
        window.history.replaceState({}, '', `?${urlParts.join('&')}`);

        const useStore = createComplexStore(marked, false);
        render(<ComplexStateDisplay store={useStore} />);

        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect
          .element(page.getByTestId('count-type'))
          .toHaveTextContent('number');
        await expect
          .element(page.getByTestId('active'))
          .toHaveTextContent('true');
        await expect
          .element(page.getByTestId('active-type'))
          .toHaveTextContent('boolean');
      });
    });

    describe('custom configuration', () => {
      const customConfigs: Array<{
        name: string;
        options: MarkedFormatOptions;
      }> = [
        {
          name: 'alternative separators',
          options: { separator: ';', terminator: '!' },
        },
        {
          name: 'alternative type markers',
          options: {
            typeObject: 'O',
            typeArray: 'A',
            typeString: 'S',
            typePrimitive: 'P',
          },
        },
        {
          name: 'alternative escape char',
          options: { escapeChar: '\\' },
        },
        {
          name: 'alternative date prefix',
          options: { datePrefix: 'T' },
        },
        {
          name: 'all custom options',
          options: {
            typeObject: 'O',
            typeArray: 'A',
            typeString: 'S',
            typePrimitive: 'P',
            separator: ';',
            terminator: '!',
            escapeChar: '\\',
            datePrefix: 'T',
          },
        },
      ];

      for (const config of customConfigs) {
        it(`should round-trip complex state with ${config.name}`, async () => {
          const format = createMarkedFormat(config.options);
          const useStore = createComplexStore(format, false);

          render(<ComplexStateDisplay store={useStore} />);
          await page.getByRole('button', { name: 'Set Complex' }).click();

          await expect
            .element(page.getByTestId('search'))
            .toHaveTextContent('hello, world');
          await expect
            .element(page.getByTestId('count'))
            .toHaveTextContent('42');
          await expect
            .element(page.getByTestId('count-type'))
            .toHaveTextContent('number');
          await expect
            .element(page.getByTestId('active'))
            .toHaveTextContent('true');
          await expect
            .element(page.getByTestId('active-type'))
            .toHaveTextContent('boolean');
          await expect
            .element(page.getByTestId('tags'))
            .toHaveTextContent('["typescript","react","zustand"]');
          await expect
            .element(page.getByTestId('user-name'))
            .toHaveTextContent('John Doe');
          await expect
            .element(page.getByTestId('created-is-date'))
            .toHaveTextContent('true');
        });

        it(`should restore state from URL with ${config.name}`, async () => {
          const format = createMarkedFormat(config.options);
          const params = format.stringifyStandalone(complexTestState);
          const urlParts: string[] = [];
          for (const [key, values] of Object.entries(params)) {
            for (const value of values) {
              urlParts.push(`${key}=${value}`);
            }
          }
          window.history.replaceState({}, '', `?${urlParts.join('&')}`);

          const useStore = createComplexStore(format, false);
          render(<ComplexStateDisplay store={useStore} />);

          await expect
            .element(page.getByTestId('search'))
            .toHaveTextContent('hello, world');
          await expect
            .element(page.getByTestId('count-type'))
            .toHaveTextContent('number');
          await expect
            .element(page.getByTestId('active-type'))
            .toHaveTextContent('boolean');
        });
      }
    });
  });

  describe('namespaced mode (key: "state")', () => {
    describe('default configuration', () => {
      it('should round-trip complex state in single param', async () => {
        const useStore = createComplexStore(marked, 'state');

        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Complex' }).click();

        // URL should contain single 'state' param
        expect(window.location.search).toContain('state=');

        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect
          .element(page.getByTestId('count-type'))
          .toHaveTextContent('number');
        await expect
          .element(page.getByTestId('price'))
          .toHaveTextContent('99.99');
        await expect
          .element(page.getByTestId('active'))
          .toHaveTextContent('true');
        await expect
          .element(page.getByTestId('active-type'))
          .toHaveTextContent('boolean');
        await expect
          .element(page.getByTestId('tags'))
          .toHaveTextContent('["typescript","react","zustand"]');
        await expect
          .element(page.getByTestId('user-name'))
          .toHaveTextContent('John Doe');
        await expect
          .element(page.getByTestId('user-daily'))
          .toHaveTextContent('500');
        await expect
          .element(page.getByTestId('items-length'))
          .toHaveTextContent('2');
      });

      it('should restore complex state from namespaced URL', async () => {
        const encoded = marked.stringify(complexTestState);
        window.history.replaceState({}, '', `?state=${encoded}`);

        const useStore = createComplexStore(marked, 'state');
        render(<ComplexStateDisplay store={useStore} />);

        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect
          .element(page.getByTestId('count-type'))
          .toHaveTextContent('number');
        await expect
          .element(page.getByTestId('user-name'))
          .toHaveTextContent('John Doe');
      });

      it('should handle special characters in namespaced mode', async () => {
        const useStore = createComplexStore(marked, 'state');

        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Special' }).click();

        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('test.@=:,~/value');
        await expect
          .element(page.getByTestId('user-name'))
          .toHaveTextContent('José García');
      });
    });

    describe('custom configuration', () => {
      it('should work with all custom options in namespaced mode', async () => {
        const format = createMarkedFormat({
          typeObject: 'O',
          typeArray: 'A',
          typeString: 'S',
          typePrimitive: 'P',
          separator: ';',
          terminator: '!',
          escapeChar: '\\',
          datePrefix: 'T',
        });
        const useStore = createComplexStore(format, 'mystate');

        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Complex' }).click();

        expect(window.location.search).toContain('mystate=');
        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('hello, world');
        await expect
          .element(page.getByTestId('count-type'))
          .toHaveTextContent('number');
        await expect
          .element(page.getByTestId('active-type'))
          .toHaveTextContent('boolean');
      });
    });
  });
});

// =============================================================================
// PLAIN FORMAT TESTS
// =============================================================================

describe('Plain Format - Comprehensive Browser Tests', () => {
  describe('standalone mode (key: false)', () => {
    describe('default configuration', () => {
      it('should round-trip complex state', async () => {
        const useStore = createComplexStore(plain, false);

        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Complex' }).click();

        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect
          .element(page.getByTestId('price'))
          .toHaveTextContent('99.99');
        await expect
          .element(page.getByTestId('active'))
          .toHaveTextContent('true');
        await expect
          .element(page.getByTestId('verified'))
          .toHaveTextContent('false');
        await expect
          .element(page.getByTestId('nothing'))
          .toHaveTextContent('null');
        await expect
          .element(page.getByTestId('tags'))
          .toHaveTextContent('["typescript","react","zustand"]');
        await expect
          .element(page.getByTestId('user-name'))
          .toHaveTextContent('John Doe');
        await expect
          .element(page.getByTestId('user-theme'))
          .toHaveTextContent('dark');
      });

      it('should round-trip special characters', async () => {
        const useStore = createComplexStore(plain, false);

        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Special' }).click();

        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('test.@=:,~/value');
        await expect
          .element(page.getByTestId('user-name'))
          .toHaveTextContent('José García');
      });

      it('should round-trip unicode', async () => {
        const useStore = createComplexStore(plain, false);

        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Unicode' }).click();

        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('你好世界 👋🌍 café');
        await expect
          .element(page.getByTestId('user-name'))
          .toHaveTextContent('Müller');
      });

      it('should restore state from URL', async () => {
        const params = plain.stringifyStandalone(complexTestState);
        const urlParts: string[] = [];
        for (const [key, values] of Object.entries(params)) {
          for (const value of values) {
            urlParts.push(`${key}=${value}`);
          }
        }
        window.history.replaceState({}, '', `?${urlParts.join('&')}`);

        const useStore = createComplexStore(plain, false);
        render(<ComplexStateDisplay store={useStore} />);

        await expect
          .element(page.getByTestId('search'))
          .toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect
          .element(page.getByTestId('user-name'))
          .toHaveTextContent('John Doe');
      });
    });

    describe('custom configuration', () => {
      const customConfigs: Array<{
        name: string;
        options: PlainFormatOptions;
      }> = [
        {
          name: 'semicolon entry separator',
          options: { entrySeparator: ';' },
        },
        {
          name: 'slash nesting separator',
          options: { nestingSeparator: '/' },
        },
        {
          name: 'backslash escape char',
          options: { escapeChar: '\\' },
        },
        {
          name: 'custom null/undefined strings',
          options: { nullString: 'nil', undefinedString: 'undef' },
        },
        {
          name: 'all custom options',
          options: {
            entrySeparator: ';',
            nestingSeparator: '/',
            escapeChar: '\\',
            nullString: 'nil',
            undefinedString: 'undef',
          },
        },
      ];

      for (const config of customConfigs) {
        it(`should round-trip with ${config.name}`, async () => {
          const format = createPlainFormat(config.options);
          const useStore = createComplexStore(format, false);

          render(<ComplexStateDisplay store={useStore} />);
          await page.getByRole('button', { name: 'Set Complex' }).click();

          await expect
            .element(page.getByTestId('search'))
            .toHaveTextContent('hello, world');
          await expect
            .element(page.getByTestId('count'))
            .toHaveTextContent('42');
          await expect
            .element(page.getByTestId('user-name'))
            .toHaveTextContent('John Doe');
        });
      }
    });
  });

  describe('namespaced mode (key: "state")', () => {
    it('should round-trip complex state in single param', async () => {
      const useStore = createComplexStore(plain, 'state');

      render(<ComplexStateDisplay store={useStore} />);
      await page.getByRole('button', { name: 'Set Complex' }).click();

      expect(window.location.search).toContain('state=');
      await expect
        .element(page.getByTestId('search'))
        .toHaveTextContent('hello, world');
      await expect.element(page.getByTestId('count')).toHaveTextContent('42');
      await expect
        .element(page.getByTestId('user-name'))
        .toHaveTextContent('John Doe');
    });

    it('should restore from namespaced URL', async () => {
      const encoded = plain.stringify(complexTestState);
      window.history.replaceState({}, '', `?state=${encoded}`);

      const useStore = createComplexStore(plain, 'state');
      render(<ComplexStateDisplay store={useStore} />);

      await expect
        .element(page.getByTestId('search'))
        .toHaveTextContent('hello, world');
      await expect.element(page.getByTestId('count')).toHaveTextContent('42');
    });

    it('should work with custom options in namespaced mode', async () => {
      const format = createPlainFormat({
        entrySeparator: ';',
        nestingSeparator: '/',
        escapeChar: '\\',
      });
      const useStore = createComplexStore(format, 'data');

      render(<ComplexStateDisplay store={useStore} />);
      await page.getByRole('button', { name: 'Set Complex' }).click();

      expect(window.location.search).toContain('data=');
      await expect
        .element(page.getByTestId('search'))
        .toHaveTextContent('hello, world');
    });
  });
});

// =============================================================================
// EDGE CASES AND REGRESSION TESTS
// =============================================================================

describe('Edge Cases and Regression Tests', () => {
  describe('empty values', () => {
    it('should handle empty string', async () => {
      interface Store {
        text: string;
        setText: (text: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          set => ({ text: 'initial', setText: text => set({ text }) }),
          { key: false, format: marked },
        ),
      );

      function TestComponent() {
        const { text, setText } = useStore();
        return (
          <div>
            <span data-testid="text">{text || '(empty)'}</span>
            <button onClick={() => setText('')}>Clear</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Clear' }).click();
      await expect
        .element(page.getByTestId('text'))
        .toHaveTextContent('(empty)');
    });

    it('should handle empty array', async () => {
      interface Store {
        items: string[];
        setItems: (items: string[]) => void;
      }

      const useStore = create<Store>()(
        querystring(
          set => ({ items: ['a', 'b'], setItems: items => set({ items }) }),
          { key: false, format: marked },
        ),
      );

      function TestComponent() {
        const { items, setItems } = useStore();
        return (
          <div>
            <span data-testid="items">{JSON.stringify(items)}</span>
            <button onClick={() => setItems([])}>Clear</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Clear' }).click();
      await expect.element(page.getByTestId('items')).toHaveTextContent('[]');
    });
  });

  describe('parameters without a value', () => {
    it('should keep a parameter without a value in its place', () => {
      window.history.replaceState(
        {},
        '',
        `?closed&state=${marked.stringify({ sort: 'name' })}`,
      );
      const useStore = create<{ sort: string }>()(
        querystring(() => ({ sort: '' }), { key: 'state', format: marked }),
      );

      useStore.setState({ sort: 'date' });

      expect(window.location.search).toBe(
        `?closed&state=${marked.stringify({ sort: 'date' })}`,
      );
    });

    it('should ignore a parameter without a value on read, and keep it on write', () => {
      window.history.replaceState({}, '', '/?closed&count=:5');
      const useStore = createNavStore();
      expect(useStore.getState()).not.toHaveProperty('closed');

      useStore.setState({ count: 6 });

      expect(window.location.search).toBe('?closed&count=:6');
    });
  });

  describe('parameters of other code', () => {
    it('should keep the place of a parameter the store rewrites', () => {
      window.history.replaceState({}, '', '/?a=1&count=:5&b=2');
      const useStore = createNavStore();

      useStore.setState({ count: 6 });

      expect(window.location.search).toBe('?a=1&count=:6&b=2');
    });
  });

  describe('React Strict Mode', () => {
    it('should keep the state in the URL after a pathname change', async () => {
      const createStore = () =>
        create<{ step: number }>()(querystring(() => ({ step: 0 })));
      let store!: ReturnType<typeof createStore>;

      function Provider() {
        const [useStore] = useState(createStore);
        useStore(state => state.step);
        store = useStore;
        return null;
      }

      await render(
        <StrictMode>
          <Provider />
        </StrictMode>,
      );
      store.setState({ step: 5 });
      window.history.pushState({}, '', '/strict-mode');
      // The URL is rewritten 100ms after a pathname change.
      await new Promise(r => setTimeout(r, 200));

      expect(new URLSearchParams(window.location.search).get('step')).toBe(
        ':5',
      );
    });
  });

  describe('string with comma (regression test)', () => {
    it('marked: should preserve comma in string through round-trip', async () => {
      interface Store {
        search: string;
        setSearch: (search: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          set => ({ search: '', setSearch: search => set({ search }) }),
          { key: false, format: marked },
        ),
      );

      function TestComponent() {
        const { search, setSearch } = useStore();
        return (
          <div>
            <span data-testid="search">{search}</span>
            <button onClick={() => setSearch('hello, world')}>Set</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect
        .element(page.getByTestId('search'))
        .toHaveTextContent('hello, world');
    });

    it('marked: should restore comma in string from URL', async () => {
      interface Store {
        search: string;
      }

      const encoded = marked.stringifyStandalone({ search: 'hello, world' });
      window.history.replaceState({}, '', `?search=${encoded.search[0]}`);

      const useStore = create<Store>()(
        querystring(() => ({ search: '' }), { key: false, format: marked }),
      );

      function TestComponent() {
        const search = useStore(s => s.search);
        return <span data-testid="search">{search}</span>;
      }

      render(<TestComponent />);
      await expect
        .element(page.getByTestId('search'))
        .toHaveTextContent('hello, world');
    });

    it('plain: should preserve comma in string through round-trip', async () => {
      interface Store {
        search: string;
        setSearch: (search: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          set => ({ search: '', setSearch: search => set({ search }) }),
          { key: false, format: plain },
        ),
      );

      function TestComponent() {
        const { search, setSearch } = useStore();
        return (
          <div>
            <span data-testid="search">{search}</span>
            <button onClick={() => setSearch('hello, world')}>Set</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect
        .element(page.getByTestId('search'))
        .toHaveTextContent('hello, world');
    });
  });

  describe('decimal numbers', () => {
    it('marked: should preserve decimal precision', async () => {
      interface Store {
        price: number;
        setPrice: (price: number) => void;
      }

      const useStore = create<Store>()(
        querystring(set => ({ price: 0, setPrice: price => set({ price }) }), {
          key: false,
          format: marked,
        }),
      );

      function TestComponent() {
        const { price, setPrice } = useStore();
        return (
          <div>
            <span data-testid="price">{price}</span>
            <span data-testid="type">{typeof price}</span>
            <button onClick={() => setPrice(99.99)}>Set</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect
        .element(page.getByTestId('price'))
        .toHaveTextContent('99.99');
      await expect
        .element(page.getByTestId('type'))
        .toHaveTextContent('number');
    });
  });

  describe('negative numbers', () => {
    it('marked: should handle negative numbers', async () => {
      interface Store {
        value: number;
        setValue: (value: number) => void;
      }

      const useStore = create<Store>()(
        querystring(set => ({ value: 0, setValue: value => set({ value }) }), {
          key: false,
          format: marked,
        }),
      );

      function TestComponent() {
        const { value, setValue } = useStore();
        return (
          <div>
            <span data-testid="value">{value}</span>
            <span data-testid="type">{typeof value}</span>
            <button onClick={() => setValue(-42.5)}>Set</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect
        .element(page.getByTestId('value'))
        .toHaveTextContent('-42.5');
      await expect
        .element(page.getByTestId('type'))
        .toHaveTextContent('number');
    });
  });

  describe('deeply nested objects', () => {
    it('marked: should handle 5 levels of nesting', async () => {
      interface DeepState {
        a: { b: { c: { d: { e: string } } } };
        setE: (e: string) => void;
      }

      const useStore = create<DeepState>()(
        querystring(
          set => ({
            a: { b: { c: { d: { e: '' } } } },
            setE: e => set({ a: { b: { c: { d: { e } } } } }),
          }),
          { key: false, format: marked },
        ),
      );

      function TestComponent() {
        const { a, setE } = useStore();
        return (
          <div>
            <span data-testid="e">{a.b.c.d.e}</span>
            <button onClick={() => setE('deep value')}>Set</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect
        .element(page.getByTestId('e'))
        .toHaveTextContent('deep value');
    });
  });

  describe('array of objects', () => {
    it('marked: should preserve array of objects', async () => {
      interface Store {
        items: Array<{ id: number; name: string }>;
        setItems: (items: Store['items']) => void;
      }

      const useStore = create<Store>()(
        querystring(set => ({ items: [], setItems: items => set({ items }) }), {
          key: false,
          format: marked,
        }),
      );

      function TestComponent() {
        const { items, setItems } = useStore();
        return (
          <div>
            <span data-testid="items">{JSON.stringify(items)}</span>
            <span data-testid="count">{items.length}</span>
            <button
              onClick={() =>
                setItems([
                  { id: 1, name: 'A' },
                  { id: 2, name: 'B' },
                ])
              }
            >
              Set
            </button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect.element(page.getByTestId('count')).toHaveTextContent('2');
      await expect
        .element(page.getByTestId('items'))
        .toHaveTextContent('[{"id":1,"name":"A"},{"id":2,"name":"B"}]');
    });
  });

  describe('mixed arrays', () => {
    it('marked: should handle arrays with multiple types', async () => {
      interface Store {
        mixed: (string | number | boolean)[];
        setMixed: (mixed: Store['mixed']) => void;
      }

      const useStore = create<Store>()(
        querystring(set => ({ mixed: [], setMixed: mixed => set({ mixed }) }), {
          key: false,
          format: marked,
        }),
      );

      function TestComponent() {
        const { mixed, setMixed } = useStore();
        return (
          <div>
            <span data-testid="mixed">{JSON.stringify(mixed)}</span>
            <span data-testid="types">
              {mixed.map(m => typeof m).join(',')}
            </span>
            <button
              onClick={() => setMixed(['text', 42, true, 'more', 0, false])}
            >
              Set
            </button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect
        .element(page.getByTestId('mixed'))
        .toHaveTextContent('["text",42,true,"more",0,false]');
      await expect
        .element(page.getByTestId('types'))
        .toHaveTextContent('string,number,boolean,string,number,boolean');
    });
  });
});

// =============================================================================
// DYNAMIC FILTER KEYS WITH DOTTED NAMES AND ARRAYS
// (Reproduces GitHub issue: filters with dynamic keys like "gpus.architecture")
// =============================================================================

describe('Dynamic filter keys with dotted names and arrays', () => {
  interface FilterState {
    query: string;
    filters: Record<string, string[]>;
    setQuery: (query: string) => void;
    setFilters: (filters: Record<string, string[]>) => void;
    clearFilters: () => void;
  }

  const filterInitialState = {
    query: '',
    filters: {} as Record<string, string[]>,
  };

  function createFilterStore(format: any, key: string | false) {
    return create<FilterState>()(
      querystring(
        set => ({
          ...filterInitialState,
          setQuery: query => set({ query }),
          setFilters: filters => set({ filters }),
          clearFilters: () => set({ filters: {} }),
        }),
        { key, format },
      ),
    );
  }

  function FilterDisplay({
    store,
  }: {
    store: ReturnType<typeof createFilterStore>;
  }) {
    const state = store();
    return (
      <div>
        <span data-testid="query">{state.query}</span>
        <span data-testid="filters">{JSON.stringify(state.filters)}</span>
        <span data-testid="url">{window.location.search}</span>
        <button
          onClick={() => {
            state.setQuery('ubuntu');
            state.setFilters({ 'gpus.architecture': ['Blackwell', 'Ada'] });
          }}
        >
          Set Filters
        </button>
        <button onClick={() => state.clearFilters()}>Clear Filters</button>
        <button onClick={() => state.setQuery('')}>Clear Query</button>
      </div>
    );
  }

  describe('plain format (default, arraySep=",")', () => {
    it('should serialize dotted filter keys with array values', async () => {
      const useStore = createFilterStore(plain, false);
      render(<FilterDisplay store={useStore} />);

      await page.getByRole('button', { name: 'Set Filters' }).click();
      await expect
        .element(page.getByTestId('query'))
        .toHaveTextContent('ubuntu');
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');
    });

    it('should restore filter array from URL on mount (comma-separated)', async () => {
      // Pre-set URL with comma-separated array (what stringifyStandalone produces)
      const params = plain.stringifyStandalone({
        query: 'ubuntu',
        filters: { 'gpus.architecture': ['Blackwell', 'Ada'] },
      });
      const urlParts: string[] = [];
      for (const [key, values] of Object.entries(params)) {
        for (const value of values) {
          urlParts.push(`${key}=${value}`);
        }
      }
      window.history.replaceState({}, '', `?${urlParts.join('&')}`);

      const useStore = createFilterStore(plain, false);
      render(<FilterDisplay store={useStore} />);

      await expect
        .element(page.getByTestId('query'))
        .toHaveTextContent('ubuntu');
      // This is the key assertion: the array should be parsed as two values, not one string
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');
    });

    it('should clear filters from URL when reset to {}', async () => {
      const useStore = createFilterStore(plain, false);
      render(<FilterDisplay store={useStore} />);

      // Set filters
      await page.getByRole('button', { name: 'Set Filters' }).click();
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');

      // Verify URL has filter params
      const urlAfterSet = window.location.search;
      expect(urlAfterSet).toContain('filters');

      // Clear filters
      await page.getByRole('button', { name: 'Clear Filters' }).click();
      await expect.element(page.getByTestId('filters')).toHaveTextContent('{}');

      // URL should no longer contain filter params
      const urlAfterClear = window.location.search;
      expect(urlAfterClear).not.toContain('filters');
    });
  });

  describe('plain format with arraySeparator: "repeat"', () => {
    it('should serialize dotted filter keys as repeated params', async () => {
      const format = createPlainFormat({ arraySeparator: 'repeat' });
      const useStore = createFilterStore(format, false);
      render(<FilterDisplay store={useStore} />);

      await page.getByRole('button', { name: 'Set Filters' }).click();
      await expect
        .element(page.getByTestId('query'))
        .toHaveTextContent('ubuntu');
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');
    });

    it('should restore filter array from URL on mount (repeated keys)', async () => {
      const format = createPlainFormat({ arraySeparator: 'repeat' });
      const params = format.stringifyStandalone({
        query: 'ubuntu',
        filters: { 'gpus.architecture': ['Blackwell', 'Ada'] },
      });
      const urlParts: string[] = [];
      for (const [key, values] of Object.entries(params)) {
        for (const value of values) {
          urlParts.push(`${key}=${value}`);
        }
      }
      window.history.replaceState({}, '', `?${urlParts.join('&')}`);

      const useStore = createFilterStore(format, false);
      render(<FilterDisplay store={useStore} />);

      await expect
        .element(page.getByTestId('query'))
        .toHaveTextContent('ubuntu');
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');
    });

    it('should clear filters from URL when reset to {}', async () => {
      const format = createPlainFormat({ arraySeparator: 'repeat' });
      const useStore = createFilterStore(format, false);
      render(<FilterDisplay store={useStore} />);

      await page.getByRole('button', { name: 'Set Filters' }).click();
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');
      expect(window.location.search).toContain('filters');

      await page.getByRole('button', { name: 'Clear Filters' }).click();
      await expect.element(page.getByTestId('filters')).toHaveTextContent('{}');
      expect(window.location.search).not.toContain('filters');
    });
  });

  describe('plain format with nestingSeparator: ":", arraySeparator: "repeat"', () => {
    it('should use colon for nesting and not escape dots in filter keys', async () => {
      const format = createPlainFormat({
        nestingSeparator: ':',
        arraySeparator: 'repeat',
      });
      const useStore = createFilterStore(format, false);
      render(<FilterDisplay store={useStore} />);

      await page.getByRole('button', { name: 'Set Filters' }).click();
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');

      // With ':' as nesting separator, dots in keys should NOT be escaped
      expect(window.location.search).toContain('gpus.architecture');
      expect(window.location.search).not.toContain('gpus_.architecture');
    });

    it('should restore from URL on mount', async () => {
      const format = createPlainFormat({
        nestingSeparator: ':',
        arraySeparator: 'repeat',
      });
      window.history.replaceState(
        {},
        '',
        '?query=ubuntu&filters:gpus.architecture=Blackwell&filters:gpus.architecture=Ada',
      );

      const useStore = createFilterStore(format, false);
      render(<FilterDisplay store={useStore} />);

      await expect
        .element(page.getByTestId('query'))
        .toHaveTextContent('ubuntu');
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');
    });

    it('should clear filters from URL when reset to {}', async () => {
      const format = createPlainFormat({
        nestingSeparator: ':',
        arraySeparator: 'repeat',
      });
      const useStore = createFilterStore(format, false);
      render(<FilterDisplay store={useStore} />);

      await page.getByRole('button', { name: 'Set Filters' }).click();
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');

      await page.getByRole('button', { name: 'Clear Filters' }).click();
      await expect.element(page.getByTestId('filters')).toHaveTextContent('{}');
      expect(window.location.search).not.toContain('filters');
    });
  });

  describe('plain format with nestingSeparator: ":", arraySeparator: ","', () => {
    it('should serialize and restore comma-separated array with colon nesting', async () => {
      const format = createPlainFormat({
        nestingSeparator: ':',
        arraySeparator: ',',
      });
      const useStore = createFilterStore(format, false);
      render(<FilterDisplay store={useStore} />);

      await page.getByRole('button', { name: 'Set Filters' }).click();
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');
    });

    it('should restore comma-separated array from URL on mount', async () => {
      const format = createPlainFormat({
        nestingSeparator: ':',
        arraySeparator: ',',
      });
      window.history.replaceState(
        {},
        '',
        '?query=ubuntu&filters:gpus.architecture=Blackwell,Ada',
      );

      const useStore = createFilterStore(format, false);
      render(<FilterDisplay store={useStore} />);

      await expect
        .element(page.getByTestId('query'))
        .toHaveTextContent('ubuntu');
      // The key assertion: comma-joined values should be parsed as array
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');
    });
  });

  describe('marked format (for comparison)', () => {
    it('should handle dotted filter keys with arrays', async () => {
      const useStore = createFilterStore(marked, false);
      render(<FilterDisplay store={useStore} />);

      await page.getByRole('button', { name: 'Set Filters' }).click();
      await expect
        .element(page.getByTestId('query'))
        .toHaveTextContent('ubuntu');
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');
    });

    it('should restore from URL on mount', async () => {
      const params = marked.stringifyStandalone({
        query: 'ubuntu',
        filters: { 'gpus.architecture': ['Blackwell', 'Ada'] },
      });
      const urlParts: string[] = [];
      for (const [key, values] of Object.entries(params)) {
        for (const value of values) {
          urlParts.push(`${key}=${value}`);
        }
      }
      window.history.replaceState({}, '', `?${urlParts.join('&')}`);

      const useStore = createFilterStore(marked, false);
      render(<FilterDisplay store={useStore} />);

      await expect
        .element(page.getByTestId('query'))
        .toHaveTextContent('ubuntu');
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');
    });

    it('should clear filters from URL when reset to {}', async () => {
      const useStore = createFilterStore(marked, false);
      render(<FilterDisplay store={useStore} />);

      await page.getByRole('button', { name: 'Set Filters' }).click();
      await expect
        .element(page.getByTestId('filters'))
        .toHaveTextContent('{"gpus.architecture":["Blackwell","Ada"]}');
      expect(window.location.search).toContain('filters');

      await page.getByRole('button', { name: 'Clear Filters' }).click();
      await expect.element(page.getByTestId('filters')).toHaveTextContent('{}');
      expect(window.location.search).not.toContain('filters');
    });
  });
});

// =============================================================================
// MAP OPTION - Bidirectional mapping between store state and URL state
// =============================================================================

describe('map option', () => {
  // Simulates a store keyed by dynamic ID where the URL should only
  // reflect the "active" entry based on the pathname.
  interface MultiPageStore {
    itemsById: Record<string, { tags: string[] }>;
    settingsById: Record<string, string>;
    setTags: (id: string, tags: string[]) => void;
    setSetting: (id: string, value: string) => void;
  }

  function getIdFromPathname(pathname: string): string {
    const match = pathname.match(/\/view\/([^/?]+)/);
    return match ? match[1] : 'default';
  }

  function createMappedStore() {
    return create<MultiPageStore>()(
      querystring(
        set => ({
          itemsById: {},
          settingsById: {},
          setTags: (id, tags) =>
            set(state => ({
              itemsById: {
                ...state.itemsById,
                [id]: { tags },
              },
            })),
          setSetting: (id, value) =>
            set(state => ({
              settingsById: {
                ...state.settingsById,
                [id]: value,
              },
            })),
        }),
        {
          key: 'state',
          select: pathname => ({
            itemsById: pathname.startsWith('/view/'),
            settingsById: pathname.startsWith('/view/'),
          }),
          map: createMap({
            to: (state: MultiPageStore, pathname) => {
              const id = getIdFromPathname(pathname);
              return {
                tags: state.itemsById?.[id]?.tags,
                setting: state.settingsById?.[id],
              };
            },
            from: (urlState, pathname) => {
              const id = getIdFromPathname(pathname);
              return {
                ...(urlState.tags
                  ? { itemsById: { [id]: { tags: urlState.tags } } }
                  : {}),
                ...(urlState.setting
                  ? { settingsById: { [id]: urlState.setting } }
                  : {}),
              };
            },
          }),
        },
      ),
    );
  }

  function MappedDisplay({
    store,
  }: {
    store: ReturnType<typeof createMappedStore>;
  }) {
    const state = store();
    const id = getIdFromPathname(window.location.pathname);
    const tags = state.itemsById[id]?.tags ?? [];
    const setting = state.settingsById[id] ?? '';
    return (
      <div>
        <span data-testid="tags">{JSON.stringify(tags)}</span>
        <span data-testid="setting">{setting}</span>
        <span data-testid="url">{window.location.search}</span>
        <button onClick={() => state.setTags(id, ['react', 'zustand'])}>
          Set Tags
        </button>
        <button onClick={() => state.setSetting(id, 'dark')}>
          Set Setting
        </button>
      </div>
    );
  }

  it('should serialize mapped state to URL', async () => {
    window.history.replaceState({}, '', '/view/page-1');
    const useStore = createMappedStore();
    render(<MappedDisplay store={useStore} />);

    await page.getByRole('button', { name: 'Set Tags' }).click();
    await expect
      .element(page.getByTestId('tags'))
      .toHaveTextContent('["react","zustand"]');

    const search = window.location.search;
    expect(search).toContain('state=');
    expect(search).not.toContain('itemsById');
  });

  it('should restore mapped state from URL on mount', async () => {
    const { stringify } = await import('./marked.js');
    const encoded = stringify({
      tags: ['typescript', 'testing'],
      setting: 'light',
    });
    window.history.replaceState({}, '', `/view/page-2?state=${encoded}`);

    const useStore = createMappedStore();
    render(<MappedDisplay store={useStore} />);

    await expect
      .element(page.getByTestId('tags'))
      .toHaveTextContent('["typescript","testing"]');
    await expect
      .element(page.getByTestId('setting'))
      .toHaveTextContent('light');
  });

  it('should not sync when select returns false for path', async () => {
    window.history.replaceState({}, '', '/home');
    // Earlier tests' stores rewrite their params 100ms after a pathname change.
    await new Promise(requestAnimationFrame);
    await new Promise(r => setTimeout(r, 150));
    window.history.replaceState({}, '', '/home');
    const useStore = createMappedStore();
    render(<MappedDisplay store={useStore} />);

    await page.getByRole('button', { name: 'Set Tags' }).click();

    expect(window.location.search).not.toContain('state=');
  });

  it('should not write defaults to URL after setDefaults', async () => {
    window.history.replaceState({}, '', '/view/page-1');
    const useStore = createMappedStore();

    const defaults = {
      itemsById: { 'page-1': { tags: ['default-a', 'default-b'] } },
      settingsById: { 'page-1': 'dark' },
    };

    useStore.setDefaults(defaults);
    useStore.setState(defaults);

    expect(window.location.search).not.toContain('state=');

    useStore.getState().setTags('page-1', ['custom']);

    function Display() {
      const state = useStore();
      return (
        <span data-testid="tags">
          {JSON.stringify(state.itemsById['page-1']?.tags ?? [])}
        </span>
      );
    }

    render(<Display />);
    await expect
      .element(page.getByTestId('tags'))
      .toHaveTextContent('["custom"]');
    expect(window.location.search).toContain('state=');
  });

  it('should preserve array element order across URL roundtrip', async () => {
    const { stringify } = await import('./marked.js');
    const originalTags = ['z-last', 'a-first', 'm-middle'];
    const encoded = stringify({
      tags: originalTags,
      setting: 'dark',
    });
    window.history.replaceState({}, '', `/view/page-1?state=${encoded}`);

    const useStore = createMappedStore();

    function Display() {
      const state = useStore();
      const tags = state.itemsById['page-1']?.tags ?? [];
      return <span data-testid="tags">{JSON.stringify(tags)}</span>;
    }

    render(<Display />);

    await expect
      .element(page.getByTestId('tags'))
      .toHaveTextContent(JSON.stringify(originalTags));

    expect(window.location.search).toContain('state=');

    // Setting same values again should not change the URL
    const prevSearch = window.location.search;
    useStore.getState().setTags('page-1', originalTags);
    expect(window.location.search).toBe(prevSearch);
  });

  it('a link sets the entry of an id that names an Object method', async () => {
    window.history.replaceState({}, '', '/view/page-1');
    const useStore = createMappedStore();
    const unsubscribe = useStore.subscribe(() => {});
    const href = useStore.href('/view/toString', {
      itemsById: { toString: { tags: ['a'] } },
    });

    window.history.pushState({}, '', href);
    await new Promise(r => setTimeout(r, 200));
    unsubscribe();

    expect(useStore.getState().itemsById.toString).toEqual({ tags: ['a'] });
    expect(href).toBe('/view/toString?state=tags@a');
    expect(window.location.search).toBe('?state=tags@a');
  });

  it('should clear the params of a renamed object the URL was created with', () => {
    window.history.replaceState({}, '', '/?f.a=x&f.b=y');
    const useStore = create<{ filters: Record<string, string> }>()(
      querystring(() => ({ filters: {} }), {
        format: plain,
        map: createMap({
          to: (state: { filters: Record<string, string> }) => ({
            f: state.filters,
          }),
          from: urlState => (urlState.f ? { filters: urlState.f } : {}),
        }),
      }),
    );
    expect(useStore.getState().filters).toEqual({ a: 'x', b: 'y' });

    useStore.setState({ filters: {} });

    expect(window.location.search).toBe('');
  });

  it('should handle multiple pages independently', async () => {
    window.history.replaceState({}, '', '/view/page-1');
    const useStore = createMappedStore();
    render(<MappedDisplay store={useStore} />);

    await page.getByRole('button', { name: 'Set Tags' }).click();
    await expect
      .element(page.getByTestId('tags'))
      .toHaveTextContent('["react","zustand"]');

    const storeState = useStore.getState();
    expect(storeState.itemsById['page-1']).toEqual({
      tags: ['react', 'zustand'],
    });
  });
});

// =============================================================================
// NAVIGATION - a URL the store didn't write is read like at creation
// =============================================================================

interface NavState {
  count: number;
  other: number;
  status: string;
  search?: string;
  filters: { tags: string[]; sort: string };
  setCount: (count: number) => void;
}

function createNavStore(options: QueryStringOptions<NavState> = {}) {
  return create<NavState>()(
    querystring(
      set => ({
        count: 0,
        other: 0,
        status: 'all',
        filters: { tags: [], sort: 'name' },
        setCount: count => set({ count }),
      }),
      options,
    ),
  );
}

// A store follows the URL while something is subscribed to it.
function subscribe(useStore: ReturnType<typeof createNavStore>) {
  function Count() {
    useStore(state => state.count);
    return null;
  }
  return render(<Count />);
}

const url = () =>
  window.location.pathname + decodeURIComponent(window.location.search);
// The store writes 100ms after it reads a navigation.
const settle = () => new Promise(r => setTimeout(r, 200));

describe('navigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('a link to another page sets the keys it carries and keeps the others', async () => {
    const useStore = createNavStore();
    await subscribe(useStore);
    useStore.setState({ count: 5, other: 3 });

    window.history.pushState({}, '', '/b?count=:7');
    await settle();

    expect(useStore.getState()).toMatchObject({ count: 7, other: 3 });
    expect(url()).toBe('/b?count=:7&other=:3');
  });

  it('setState then router.push writes the state to the new page', async () => {
    const useStore = createNavStore();
    await subscribe(useStore);

    useStore.setState({ count: 9 });
    window.history.pushState({}, '', '/b');
    await settle();

    expect(useStore.getState().count).toBe(9);
    expect(url()).toBe('/b?count=:9');
  });

  it('a link that changes only the query sets the key', async () => {
    const useStore = createNavStore();
    await subscribe(useStore);

    window.history.pushState({}, '', '/?count=:7');
    await settle();

    expect(useStore.getState().count).toBe(7);
    expect(url()).toBe('/?count=:7');
  });

  it('Back and Forward set the keys of the entry', async () => {
    const useStore = createNavStore();
    await subscribe(useStore);
    window.history.pushState({}, '', '/x?count=:2');
    await settle();
    window.history.pushState({}, '', '/y?count=:4');
    await settle();

    window.history.back();
    await settle();
    expect(window.location.pathname).toBe('/x');
    expect(useStore.getState().count).toBe(2);

    window.history.forward();
    await settle();
    expect(window.location.pathname).toBe('/y');
    expect(useStore.getState().count).toBe(4);
  });

  it('an action or setState right after a navigation applies after it', async () => {
    const useStore = createNavStore();
    await subscribe(useStore);

    window.history.pushState({}, '', '/b?count=:7&other=:2');
    useStore.getState().setCount(9);
    expect(useStore.getState()).toMatchObject({ count: 9, other: 2 });

    window.history.pushState({}, '', '/c?count=:8');
    useStore.setState({ count: 10 });
    expect(useStore.getState().count).toBe(10);

    await settle();
    expect(url()).toBe('/c?count=:10&other=:2');
  });

  it("a store unsubscribed before its write doesn't undo the store that replaced it", async () => {
    const replaced = createNavStore();
    const { unmount } = await subscribe(replaced);
    await settle();
    replaced.setState({ count: 5 });

    window.history.pushState({}, '', '/b?count=:5&tab=yes');
    // The store reads /b in this frame and would write 100ms later.
    await new Promise(requestAnimationFrame);
    await unmount();
    const useStore = createNavStore();
    await subscribe(useStore);
    useStore.setState({ count: 0 });
    await settle();

    expect(useStore.getState().count).toBe(0);
    expect(url()).toBe('/b?tab=yes');
  });

  it('the write a navigation owes lands when a new subscriber replaces the last one', async () => {
    const useStore = createNavStore();
    const unsubscribe = useStore.subscribe(() => {});
    await settle();
    useStore.setState({ count: 5 });

    window.history.pushState({}, '', '/b');
    // The store reads /b in this frame and writes 100ms later.
    await new Promise(requestAnimationFrame);
    unsubscribe();
    const unsubscribeNext = useStore.subscribe(() => {});
    await settle();
    unsubscribeNext();

    expect(url()).toBe('/b?count=:5');
  });

  it('pays the write a navigation owes while the page gets no frames', async () => {
    const useStore = createNavStore();
    const unsubscribe = useStore.subscribe(() => {});
    await settle();
    useStore.setState({ count: 5 });

    window.history.pushState({}, '', '/b');
    await new Promise(requestAnimationFrame);
    // A hidden page gets no animation frames.
    const { requestAnimationFrame: raf } = window;
    window.requestAnimationFrame = () => 0;
    try {
      await settle();
    } finally {
      window.requestAnimationFrame = raf;
      unsubscribe();
    }

    expect(url()).toBe('/b?count=:5');
  });

  it('pays the write a navigation owes when the clock is set back', async () => {
    const useStore = createNavStore();
    const unsubscribe = useStore.subscribe(() => {});
    await settle();
    useStore.setState({ count: 5 });

    window.history.pushState({}, '', '/b');
    await new Promise(requestAnimationFrame);
    const { now } = Date;
    Date.now = () => now() - 60_000;
    try {
      await settle();
    } finally {
      Date.now = now;
      unsubscribe();
    }

    expect(url()).toBe('/b?count=:5');
  });

  it('a subscriber that unsubscribes in its callback stops the store following the URL', async () => {
    const useStore = createNavStore();
    const unsubscribe = useStore.subscribe(state => {
      if (state.count === 2) unsubscribe();
    });
    await settle();

    window.history.pushState({}, '', '/b?count=:2');
    await new Promise(requestAnimationFrame);
    window.history.pushState({}, '', '/c?count=:4');
    await settle();

    expect(useStore.getState().count).toBe(2);
  });

  it("a store a slow callback unsubscribes doesn't undo the store that replaced it", async () => {
    const replaced = createNavStore();
    let useStore = replaced;
    let unsubscribeNext = () => {};
    const unsubscribe = replaced.subscribe(state => {
      if (state.count !== 2) return;
      unsubscribe();
      useStore = createNavStore();
      unsubscribeNext = useStore.subscribe(() => {});
      useStore.setState({ count: 0 });
      // An unmount and render slower than the 100ms the write waits.
      const end = performance.now() + 150;
      while (performance.now() < end);
    });
    await settle();

    window.history.pushState({}, '', '/b?count=:2');
    await settle();
    await settle();
    unsubscribeNext();

    expect(useStore.getState().count).toBe(0);
    expect(url()).toBe('/b');
  });

  it("a store a callback unsubscribes and routes away from doesn't undo the store that replaced it", async () => {
    const replaced = createNavStore();
    const unsubscribe = replaced.subscribe(state => {
      if (state.count !== 5) return;
      unsubscribe();
      window.history.pushState({}, '', '/b');
    });
    await settle();

    replaced.getState().setCount(5);
    const useStore = createNavStore();
    const unsubscribeNext = useStore.subscribe(() => {});
    useStore.setState({ count: 0 });
    await settle();
    unsubscribeNext();

    expect(useStore.getState().count).toBe(0);
    expect(url()).toBe('/b');
  });

  it("a store without a subscriber doesn't write the navigation a failed update read", async () => {
    const useStore = createNavStore();
    useStore.setState({ other: 5 });

    window.history.pushState({}, '', '/b?count=:2');
    expect(() =>
      useStore.setState(() => {
        throw new Error('failed');
      }),
    ).toThrow('failed');
    await settle();

    expect(url()).toBe('/b?count=:2');
  });

  it("a store unsubscribed by the navigation its timer reads doesn't write", async () => {
    const replaced = createNavStore();
    let useStore = replaced;
    let unsubscribeNext = () => {};
    const unsubscribe = replaced.subscribe(state => {
      if (state.count !== 4) return;
      unsubscribe();
      useStore = createNavStore();
      unsubscribeNext = useStore.subscribe(() => {});
      useStore.setState({ count: 0 });
    });
    await settle();

    window.history.pushState({}, '', '/b?count=:2');
    // The store reads /b in this frame and would write 100ms later.
    await new Promise(requestAnimationFrame);
    const { requestAnimationFrame: raf } = window;
    window.requestAnimationFrame = () => 0;
    try {
      // The store's last frame runs, so its timer reads /c.
      await new Promise(raf);
      window.history.pushState({}, '', '/c?count=:4');
      await settle();
    } finally {
      window.requestAnimationFrame = raf;
      unsubscribeNext();
    }

    expect(useStore.getState().count).toBe(0);
    expect(url()).toBe('/c');
  });

  it("a nested key the URL carries keeps the object's other keys", async () => {
    const useStore = createNavStore();
    await subscribe(useStore);

    window.history.pushState({}, '', '/b?filters=.tags@a');
    await settle();

    expect(useStore.getState().filters).toEqual({ tags: ['a'], sort: 'name' });
  });

  it("a param of a field select leaves out doesn't change the object", async () => {
    const useStore = create<{ filters: { shown: string; hidden: string } }>()(
      querystring(() => ({ filters: { shown: 'open', hidden: 'internal' } }), {
        format: json,
        select: () => ({ filters: { shown: true } }),
      }),
    );
    const unsubscribe = useStore.subscribe(() => {});

    window.history.pushState({}, '', '/b?filters={"hidden":"external"}');
    await settle();
    unsubscribe();

    expect(useStore.getState().filters).toEqual({
      shown: 'open',
      hidden: 'internal',
    });
  });

  it('a carried undefined clears the key, with syncUndefined', async () => {
    window.history.replaceState({}, '', '/?status=:undefined');
    const useStore = createNavStore({ syncUndefined: true });
    await subscribe(useStore);
    expect(useStore.getState().status).toBe(undefined);

    useStore.setState({ status: 'active' });
    window.history.pushState({}, '', '/b?status=:undefined');
    await settle();

    expect(useStore.getState().status).toBe(undefined);
    expect(url()).toBe('/b?status=:undefined');
  });

  it('ignores a carried undefined, without syncUndefined', async () => {
    const useStore = createNavStore();
    await subscribe(useStore);
    useStore.setState({ status: 'active' });

    window.history.pushState({}, '', '/b?status=:undefined');
    await settle();

    expect(useStore.getState().status).toBe('active');
    expect(url()).toBe('/b?status=active');
  });

  it('sets a selected key the state lacks', async () => {
    const useStore = createNavStore({
      select: () => ({ count: true, search: true }),
    });
    await subscribe(useStore);

    window.history.pushState({}, '', useStore.href('/b', { search: 'acme' }));
    await settle();

    expect(useStore.getState().search).toBe('acme');
    expect(url()).toBe('/b?search=acme');
  });

  it("sets a key the state lacks from the store's own namespace or prefix", async () => {
    for (const [options, expected] of [
      [{ key: 'state' }, '/b?state=search=acme'],
      [{ prefix: 'f_' }, '/b?f_search=acme'],
    ] as const) {
      window.history.replaceState({}, '', '/');
      const useStore = createNavStore(options);
      const unsubscribe = useStore.subscribe(() => {});

      window.history.pushState({}, '', useStore.href('/b', { search: 'acme' }));
      await settle();
      unsubscribe();

      expect(useStore.getState().search).toBe('acme');
      expect(url()).toBe(expected);
    }
  });

  it('sets a selected key the state lacks to a carried undefined, with syncUndefined', async () => {
    const useStore = createNavStore({
      syncUndefined: true,
      select: () => ({ count: true, search: true }),
    });
    await subscribe(useStore);

    window.history.pushState(
      {},
      '',
      useStore.href('/b', { search: undefined }),
    );
    await settle();

    expect('search' in useStore.getState()).toBe(true);
    expect(useStore.getState().search).toBe(undefined);
  });

  it('keeps the actions a param has the name of, nested too', async () => {
    const useStore = create<{
      search: (query: string) => void;
      filters: { tags: string[]; clear: () => void };
    }>()(
      querystring(() => ({
        search: () => {},
        filters: { tags: [], clear: () => {} },
      })),
    );
    const unsubscribe = useStore.subscribe(() => {});

    window.history.pushState({}, '', '/results?search=acme&filters=.clear=x');
    await settle();
    unsubscribe();

    expect(typeof useStore.getState().search).toBe('function');
    expect(typeof useStore.getState().filters.clear).toBe('function');
  });

  it('keeps an object holding an action, and merges into it', async () => {
    const useStore = create<{
      menu: { value: string; toggle: () => string };
    }>()(
      querystring(() => ({
        menu: { value: 'closed', toggle: () => 'toggled' },
      })),
    );
    const unsubscribe = useStore.subscribe(() => {});

    window.history.pushState({}, '', '/results?menu=expanded');
    await settle();
    expect(useStore.getState().menu.value).toBe('closed');
    expect(useStore.getState().menu.toggle()).toBe('toggled');

    window.history.pushState({}, '', '/results?menu=.value=open');
    await settle();
    expect(useStore.getState().menu.value).toBe('open');
    expect(useStore.getState().menu.toggle()).toBe('toggled');

    window.history.pushState({}, '', '/results?menu=.');
    await settle();
    unsubscribe();
    expect(useStore.getState().menu.value).toBe('open');
    expect(useStore.getState().menu.toggle()).toBe('toggled');
  });

  it('keeps an object holding an action deeper inside', async () => {
    const useStore = create<{ group: { nested?: { clear: () => number } } }>()(
      querystring(() => ({ group: { nested: { clear: () => 1 } } }), {
        format: json,
      }),
    );
    const unsubscribe = useStore.subscribe(() => {});

    window.history.pushState({}, '', useStore.href('/b', { group: {} }));
    await settle();
    unsubscribe();

    expect(useStore.getState().group.nested?.clear()).toBe(1);
  });

  it('reads a link when the state holds a circular object map.to leaves out', async () => {
    type Graph = { id: number; parent?: Graph };
    const graph: Graph = { id: 1 };
    graph.parent = graph;
    const useStore = create<{ graph: Graph; count: number }>()(
      querystring(() => ({ graph, count: 0 }), {
        map: {
          to: state => ({ id: state.graph.id, count: state.count }),
          from: urlState => ({
            graph: { id: urlState.id as number },
            count: urlState.count as number,
          }),
        },
      }),
    );
    const unsubscribe = useStore.subscribe(() => {});

    window.history.pushState(
      {},
      '',
      useStore.href('/b', { graph: { id: 2 }, count: 3 }),
    );
    await settle();
    unsubscribe();

    expect(useStore.getState().graph.id).toBe(2);
    expect(useStore.getState().count).toBe(3);
  });

  it('leaves a class instance as it is', async () => {
    class Panel {
      #title = 'Panel';
      selected = 0;
      label() {
        return this.#title + ':' + this.selected;
      }
    }
    const panel = new Panel();
    const useStore = create<{ panel: Panel }>()(
      querystring(() => ({ panel }), {
        select: () => ({ panel: { selected: true } }),
      }),
    );
    const unsubscribe = useStore.subscribe(() => {});

    window.history.pushState({}, '', '/b?panel=.selected:5');
    await settle();
    unsubscribe();

    expect(useStore.getState().panel).toBe(panel);
    expect(panel.label()).toBe('Panel:0');
  });

  it('sets the class instance map.from returns', async () => {
    class Panel {
      #id: number;
      constructor(id: number) {
        this.#id = id;
      }
      id() {
        return this.#id;
      }
    }
    const useStore = create<{ panel: Panel }>()(
      querystring(() => ({ panel: new Panel(1) }), {
        map: {
          to: state => ({ id: state.panel.id() }),
          from: urlState => ({ panel: new Panel(urlState.id as number) }),
        },
      }),
    );
    const unsubscribe = useStore.subscribe(() => {});

    window.history.pushState(
      {},
      '',
      useStore.href('/b', { panel: new Panel(2) }),
    );
    await settle();
    unsubscribe();

    expect(useStore.getState().panel.id()).toBe(2);
    expect(url()).toBe('/b?id=:2');
  });

  it('sets a class instance map.from returns inside an object', async () => {
    class Item {
      #id: number;
      constructor(id: number) {
        this.#id = id;
      }
      read() {
        return this.#id;
      }
    }
    const useStore = create<{ panel: { item: Item; label: string } }>()(
      querystring(() => ({ panel: { item: new Item(1), label: 'details' } }), {
        map: {
          to: state => ({ id: state.panel.item.read() }),
          from: urlState => ({
            panel: { item: new Item(urlState.id as number) },
          }),
        },
      }),
    );
    const unsubscribe = useStore.subscribe(() => {});

    window.history.pushState(
      {},
      '',
      useStore.href('/b', { panel: { item: new Item(2), label: 'details' } }),
    );
    await settle();
    unsubscribe();

    expect(useStore.getState().panel.item.read()).toBe(2);
    expect(useStore.getState().panel.label).toBe('details');
  });

  it('keeps an unchanged date, when another param changes', async () => {
    const useStore = create<{ since: Date }>()(
      querystring(() => ({ since: new Date('2025-01-01T00:00:00.000Z') }), {
        format: plain,
      }),
    );
    const since = new Date('2025-02-01T00:00:00.000Z');
    useStore.setState({ since });
    let calls = 0;
    const unsubscribe = useStore.subscribe(() => calls++);

    window.history.pushState(
      {},
      '',
      window.location.pathname + window.location.search + '&utm_source=x',
    );
    await settle();
    unsubscribe();

    expect(calls).toBe(0);
    expect(useStore.getState().since).toBe(since);
  });

  it("reads the URL with the initial state's types, like at creation", async () => {
    const useStore = create<{ id: string | number }>()(
      querystring(() => ({ id: 'none' }), { format: plain }),
    );
    const unsubscribe = useStore.subscribe(() => {});
    useStore.setState({ id: 12 });

    window.history.pushState({}, '', '/b?id=007');
    await settle();
    unsubscribe();

    expect(useStore.getState().id).toBe('007');
    expect(url()).toBe('/b?id=007');
  });

  it("doesn't read its own writes", async () => {
    let parses = 0;
    const useStore = createNavStore({
      format: {
        ...marked,
        parseStandalone: (params, ctx) => {
          parses++;
          return marked.parseStandalone(params, ctx);
        },
      },
    });
    await subscribe(useStore);
    await settle();
    const parsesBefore = parses;

    useStore.setState({ count: 5 });
    await settle();

    expect(url()).toBe('/?count=:5');
    expect(parses).toBe(parsesBefore);
  });

  it('reads the URL it was created on once, and writes it once subscribed', async () => {
    window.history.replaceState({}, '', '/?count=:2&other=:0');
    let parses = 0;
    const useStore = createNavStore({
      format: {
        ...marked,
        parseStandalone: (params, ctx) => {
          parses++;
          return marked.parseStandalone(params, ctx);
        },
      },
    });
    const unsubscribe = useStore.subscribe(() => {});
    await settle();
    unsubscribe();

    expect(useStore.getState().count).toBe(2);
    expect(parses).toBe(1);
    expect(url()).toBe('/?count=:2');
  });

  it("ignores params that aren't keys of the store", async () => {
    const useStore = createNavStore();
    await subscribe(useStore);

    window.history.pushState({}, '', '/?page=3');
    await settle();
    expect('page' in useStore.getState()).toBe(false);

    window.history.pushState({}, '', '/');
    await settle();
    expect(url()).toBe('/');
  });

  it("keeps the references of keys a navigation doesn't change", async () => {
    const useStore = createNavStore();
    await subscribe(useStore);
    const { filters } = useStore.getState();

    window.history.pushState({}, '', '/b?count=:7');
    await settle();

    expect(useStore.getState().count).toBe(7);
    expect(useStore.getState().filters).toBe(filters);
  });

  it('reads the URL again when it is subscribed again', async () => {
    const useStore = createNavStore();
    const { unmount } = await subscribe(useStore);
    await settle();
    await unmount();

    window.history.pushState({}, '', '/b?count=:7');
    await subscribe(useStore);
    await settle();

    expect(useStore.getState().count).toBe(7);
  });

  it("a store that was replaced doesn't undo the store that replaced it", async () => {
    const replaced = createNavStore();
    const { unmount } = await subscribe(replaced);
    replaced.setState({ count: 5 });
    await settle();
    await unmount();

    const useStore = createNavStore();
    await subscribe(useStore);
    useStore.setState({ count: 0 });
    await settle();
    expect(useStore.getState().count).toBe(0);
    expect(url()).toBe('/');

    window.history.pushState({}, '', '/b');
    await settle();
    expect(useStore.getState().count).toBe(0);
    expect(url()).toBe('/b');
  });
});

describe('href', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('writes the passed keys at their initial value too, so a link can clear a filter', async () => {
    const useStore = createNavStore();
    await subscribe(useStore);
    useStore.setState({ other: 3, status: 'active' });

    const href = useStore.href('/b', { status: 'all' });
    expect(decodeURIComponent(href)).toBe('/b?other=:3&status=all');

    window.history.pushState({}, '', href);
    await settle();
    expect(useStore.getState().status).toBe('all');
    expect(url()).toBe('/b?other=:3');
  });

  it('clears an object filter whose initial value is empty', async () => {
    const useStore = create<{ filters: { query?: string } }>()(
      querystring(() => ({ filters: {} })),
    );
    const unsubscribe = useStore.subscribe(() => {});
    useStore.setState({ filters: { query: 'x' } });

    window.history.pushState(
      {},
      '',
      useStore.href('/results', { filters: {} }),
    );
    await settle();
    unsubscribe();

    expect(useStore.getState().filters).toEqual({});
    expect(url()).toBe('/results');
  });

  it('clears an object filter with the plain format, in standalone and namespaced mode', async () => {
    for (const options of [{}, { key: 'state' }]) {
      window.history.replaceState({}, '', '/');
      const useStore = create<{ filters: { region?: string } }>()(
        querystring(() => ({ filters: {} }), { ...options, format: plain }),
      );
      const unsubscribe = useStore.subscribe(() => {});
      useStore.setState({ filters: { region: 'EU' } });

      window.history.pushState(
        {},
        '',
        useStore.href('/results', { filters: {} }),
      );
      await settle();
      unsubscribe();

      expect(useStore.getState().filters).toEqual({});
      expect(url()).toBe('/results');
    }
  });

  it('clears an object filter the initial state lacks, with the plain format', async () => {
    for (const options of [{}, { key: 'state', prefix: 'a_' }]) {
      window.history.replaceState({}, '', '/');
      const useStore = create<{ filters?: { region?: string } }>()(
        querystring(() => ({}), {
          ...options,
          format: plain,
          select: () => ({ filters: true }),
        }),
      );
      const unsubscribe = useStore.subscribe(() => {});
      useStore.setState({ filters: { region: 'EU' } });

      window.history.pushState(
        {},
        '',
        useStore.href('/results', { filters: {} }),
      );
      await settle();
      unsubscribe();

      expect(useStore.getState().filters).toEqual({});
    }
  });

  it('clears only the fields select syncs in an object', async () => {
    const useStore = create<{
      filters: { query?: string; localSort: string; reset: () => number };
    }>()(
      querystring(
        () => ({
          filters: { query: 'default', localSort: 'newest', reset: () => 1 },
        }),
        { select: () => ({ filters: { query: true } }) },
      ),
    );
    const unsubscribe = useStore.subscribe(() => {});
    useStore.setState(state => ({
      filters: { ...state.filters, query: 'open', localSort: 'oldest' },
    }));

    window.history.pushState({}, '', useStore.href('/report', { filters: {} }));
    await settle();
    unsubscribe();

    expect('query' in useStore.getState().filters).toBe(false);
    expect(useStore.getState().filters.localSort).toBe('oldest');
    expect(useStore.getState().filters.reset()).toBe(1);
  });

  it('keeps a cleared object filter in the URL, so a reload keeps it cleared', async () => {
    const initial = () => ({
      filters: { query: 'default', localSort: 'newest' } as {
        query?: string;
        localSort?: string;
      },
    });
    const useStore = create<ReturnType<typeof initial>>()(querystring(initial));
    const unsubscribe = useStore.subscribe(() => {});

    window.history.pushState({}, '', useStore.href('/report', { filters: {} }));
    await settle();
    unsubscribe();
    expect(useStore.getState().filters).toEqual({});

    const reloaded = create<ReturnType<typeof initial>>()(querystring(initial));
    expect(reloaded.getState().filters).toEqual({});
  });

  it('leaves out a key that select excludes on that page', () => {
    const useStore = createNavStore({
      select: pathname => ({ count: pathname === '/b', other: true }),
    });

    expect(useStore.href('/home', { count: 7 })).toBe('/home');
    expect(decodeURIComponent(useStore.href('/b', { count: 7 }))).toBe(
      '/b?count=:7',
    );
  });

  it('keeps a # and a & in a json value, through a link, a write and a reload', async () => {
    for (const options of [{ format: json }, { key: 'state', format: json }]) {
      for (const status of ['C#', 'R&D']) {
        window.history.replaceState({}, '', '/');
        const linked = createNavStore(options);
        const unsubscribe = linked.subscribe(() => {});
        window.history.pushState({}, '', linked.href('/b', { status }));
        await settle();
        unsubscribe();
        expect(linked.getState().status).toBe(status);

        window.history.replaceState({}, '', '/');
        createNavStore(options).setState({ status });
        expect(createNavStore(options).getState().status).toBe(status);
      }
    }
  });

  it('encodes the # a custom format leaves in a value, like the store writes it', async () => {
    // Escapes only the & that would end the param.
    const format = {
      stringify: (state: object) => JSON.stringify(state).replace(/&/g, '%26'),
      parse: (value: string) => JSON.parse(decodeURIComponent(value)),
    };
    const useStore = createNavStore({ key: 'state', format });
    const unsubscribe = useStore.subscribe(() => {});

    window.history.pushState({}, '', useStore.href('/b', { status: 'R&D #1' }));
    await settle();
    unsubscribe();

    expect(useStore.getState().status).toBe('R&D #1');
  });

  it('works in standalone and namespaced mode, with a prefix', () => {
    const standalone = createNavStore({ prefix: 'a_' });
    expect(decodeURIComponent(standalone.href('/b', { count: 2 }))).toBe(
      '/b?a_count=:2',
    );

    const namespaced = createNavStore({ key: 'state' });
    expect(namespaced.href('/b')).toBe('/b');
    expect(namespaced.href('/b', { count: 2 })).toBe('/b?state=count:2');

    const prefixed = createNavStore({ key: 'state', prefix: 'a_' });
    expect(prefixed.href('/b', { count: 2 })).toBe('/b?a_state=count:2');

    const questioned = createNavStore({ key: '?state' });
    expect(questioned.href('/b', { count: 2 })).toBe('/b??state=count:2');
  });
});
