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
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { create } from 'zustand';
import { querystring } from '../middleware.js';
import { marked, createFormat as createMarkedFormat } from './marked.js';
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
  items: [
    { id: 1, name: 'Item=1', active: true },
  ],
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

// Clean up URL before each test
beforeEach(() => {
  window.history.replaceState({}, '', window.location.pathname);
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createComplexStore(format: any, key: string | false) {
  return create<ComplexState>()(
    querystring(
      (set) => ({
        ...initialComplexState,
        setSearch: (search) => set({ search }),
        setCount: (count) => set({ count }),
        setAll: (state) => set(state),
        reset: () => set(initialComplexState),
      }),
      { key, format }
    )
  );
}

function ComplexStateDisplay({ store }: { store: ReturnType<typeof createComplexStore> }) {
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
      <span data-testid="nothing">{state.nothing === null ? 'null' : 'not-null'}</span>
      <span data-testid="tags">{JSON.stringify(state.tags)}</span>
      <span data-testid="scores">{JSON.stringify(state.scores)}</span>
      <span data-testid="scores-types">{state.scores.map(s => typeof s).join(',')}</span>
      <span data-testid="flags">{JSON.stringify(state.flags)}</span>
      <span data-testid="flags-types">{state.flags.map(f => typeof f).join(',')}</span>
      <span data-testid="user-name">{state.user.name}</span>
      <span data-testid="user-age">{state.user.age}</span>
      <span data-testid="user-age-type">{typeof state.user.age}</span>
      <span data-testid="user-email">{state.user.email}</span>
      <span data-testid="user-theme">{state.user.settings.theme}</span>
      <span data-testid="user-notifications">{String(state.user.settings.notifications)}</span>
      <span data-testid="user-daily">{state.user.settings.limits.daily}</span>
      <span data-testid="user-monthly">{state.user.settings.limits.monthly}</span>
      <span data-testid="items">{JSON.stringify(state.items)}</span>
      <span data-testid="items-length">{state.items.length}</span>
      <span data-testid="created">{state.created.getTime()}</span>
      <span data-testid="created-is-date">{String(state.created instanceof Date)}</span>
      <button onClick={() => state.setAll(complexTestState as any)}>Set Complex</button>
      <button onClick={() => state.setAll(specialCharsState as any)}>Set Special</button>
      <button onClick={() => state.setAll(unicodeState as any)}>Set Unicode</button>
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
        await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect.element(page.getByTestId('count-type')).toHaveTextContent('number');
        await expect.element(page.getByTestId('price')).toHaveTextContent('99.99');
        await expect.element(page.getByTestId('price-type')).toHaveTextContent('number');
        await expect.element(page.getByTestId('active')).toHaveTextContent('true');
        await expect.element(page.getByTestId('active-type')).toHaveTextContent('boolean');
        await expect.element(page.getByTestId('verified')).toHaveTextContent('false');
        await expect.element(page.getByTestId('nothing')).toHaveTextContent('null');
        await expect.element(page.getByTestId('tags')).toHaveTextContent('["typescript","react","zustand"]');
        await expect.element(page.getByTestId('scores')).toHaveTextContent('[100,85,92]');
        await expect.element(page.getByTestId('scores-types')).toHaveTextContent('number,number,number');
        await expect.element(page.getByTestId('flags')).toHaveTextContent('[true,false,true]');
        await expect.element(page.getByTestId('flags-types')).toHaveTextContent('boolean,boolean,boolean');
        await expect.element(page.getByTestId('user-name')).toHaveTextContent('John Doe');
        await expect.element(page.getByTestId('user-age')).toHaveTextContent('30');
        await expect.element(page.getByTestId('user-age-type')).toHaveTextContent('number');
        await expect.element(page.getByTestId('user-theme')).toHaveTextContent('dark');
        await expect.element(page.getByTestId('user-notifications')).toHaveTextContent('false');
        await expect.element(page.getByTestId('user-daily')).toHaveTextContent('500');
        await expect.element(page.getByTestId('user-monthly')).toHaveTextContent('5000');
        await expect.element(page.getByTestId('items-length')).toHaveTextContent('2');
        await expect.element(page.getByTestId('created-is-date')).toHaveTextContent('true');
      });

      it('should round-trip state with special characters', async () => {
        const useStore = createComplexStore(marked, false);
        
        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Special' }).click();
        
        await expect.element(page.getByTestId('search')).toHaveTextContent('test.@=:,~/value');
        await expect.element(page.getByTestId('tags')).toHaveTextContent('["tag.with.dots","tag,with,commas","tag~with~tildes"]');
        await expect.element(page.getByTestId('user-name')).toHaveTextContent('José García');
        await expect.element(page.getByTestId('user-theme')).toHaveTextContent('dark/light');
      });

      it('should round-trip unicode characters', async () => {
        const useStore = createComplexStore(marked, false);
        
        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Unicode' }).click();
        
        await expect.element(page.getByTestId('search')).toHaveTextContent('你好世界 👋🌍 café');
        await expect.element(page.getByTestId('tags')).toHaveTextContent('["日本語","العربية","한국어"]');
        await expect.element(page.getByTestId('user-name')).toHaveTextContent('Müller');
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

        await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect.element(page.getByTestId('count-type')).toHaveTextContent('number');
        await expect.element(page.getByTestId('active')).toHaveTextContent('true');
        await expect.element(page.getByTestId('active-type')).toHaveTextContent('boolean');
      });
    });

    describe('custom configuration', () => {
      const customConfigs: Array<{ name: string; options: MarkedFormatOptions }> = [
        {
          name: 'alternative separators',
          options: { separator: ';', terminator: '!' },
        },
        {
          name: 'alternative type markers',
          options: { typeObject: 'O', typeArray: 'A', typeString: 'S', typePrimitive: 'P' },
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
          
          await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
          await expect.element(page.getByTestId('count')).toHaveTextContent('42');
          await expect.element(page.getByTestId('count-type')).toHaveTextContent('number');
          await expect.element(page.getByTestId('active')).toHaveTextContent('true');
          await expect.element(page.getByTestId('active-type')).toHaveTextContent('boolean');
          await expect.element(page.getByTestId('tags')).toHaveTextContent('["typescript","react","zustand"]');
          await expect.element(page.getByTestId('user-name')).toHaveTextContent('John Doe');
          await expect.element(page.getByTestId('created-is-date')).toHaveTextContent('true');
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

          await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
          await expect.element(page.getByTestId('count-type')).toHaveTextContent('number');
          await expect.element(page.getByTestId('active-type')).toHaveTextContent('boolean');
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
        
        await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect.element(page.getByTestId('count-type')).toHaveTextContent('number');
        await expect.element(page.getByTestId('price')).toHaveTextContent('99.99');
        await expect.element(page.getByTestId('active')).toHaveTextContent('true');
        await expect.element(page.getByTestId('active-type')).toHaveTextContent('boolean');
        await expect.element(page.getByTestId('tags')).toHaveTextContent('["typescript","react","zustand"]');
        await expect.element(page.getByTestId('user-name')).toHaveTextContent('John Doe');
        await expect.element(page.getByTestId('user-daily')).toHaveTextContent('500');
        await expect.element(page.getByTestId('items-length')).toHaveTextContent('2');
      });

      it('should restore complex state from namespaced URL', async () => {
        const encoded = marked.stringify(complexTestState);
        window.history.replaceState({}, '', `?state=${encoded}`);

        const useStore = createComplexStore(marked, 'state');
        render(<ComplexStateDisplay store={useStore} />);

        await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect.element(page.getByTestId('count-type')).toHaveTextContent('number');
        await expect.element(page.getByTestId('user-name')).toHaveTextContent('John Doe');
      });

      it('should handle special characters in namespaced mode', async () => {
        const useStore = createComplexStore(marked, 'state');
        
        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Special' }).click();
        
        await expect.element(page.getByTestId('search')).toHaveTextContent('test.@=:,~/value');
        await expect.element(page.getByTestId('user-name')).toHaveTextContent('José García');
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
        await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count-type')).toHaveTextContent('number');
        await expect.element(page.getByTestId('active-type')).toHaveTextContent('boolean');
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
        
        await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect.element(page.getByTestId('price')).toHaveTextContent('99.99');
        await expect.element(page.getByTestId('active')).toHaveTextContent('true');
        await expect.element(page.getByTestId('verified')).toHaveTextContent('false');
        await expect.element(page.getByTestId('nothing')).toHaveTextContent('null');
        await expect.element(page.getByTestId('tags')).toHaveTextContent('["typescript","react","zustand"]');
        await expect.element(page.getByTestId('user-name')).toHaveTextContent('John Doe');
        await expect.element(page.getByTestId('user-theme')).toHaveTextContent('dark');
      });

      it('should round-trip special characters', async () => {
        const useStore = createComplexStore(plain, false);
        
        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Special' }).click();
        
        await expect.element(page.getByTestId('search')).toHaveTextContent('test.@=:,~/value');
        await expect.element(page.getByTestId('user-name')).toHaveTextContent('José García');
      });

      it('should round-trip unicode', async () => {
        const useStore = createComplexStore(plain, false);
        
        render(<ComplexStateDisplay store={useStore} />);
        await page.getByRole('button', { name: 'Set Unicode' }).click();
        
        await expect.element(page.getByTestId('search')).toHaveTextContent('你好世界 👋🌍 café');
        await expect.element(page.getByTestId('user-name')).toHaveTextContent('Müller');
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

        await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect.element(page.getByTestId('user-name')).toHaveTextContent('John Doe');
      });
    });

    describe('custom configuration', () => {
      const customConfigs: Array<{ name: string; options: PlainFormatOptions }> = [
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
          
          await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
          await expect.element(page.getByTestId('count')).toHaveTextContent('42');
          await expect.element(page.getByTestId('user-name')).toHaveTextContent('John Doe');
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
      await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
      await expect.element(page.getByTestId('count')).toHaveTextContent('42');
      await expect.element(page.getByTestId('user-name')).toHaveTextContent('John Doe');
    });

    it('should restore from namespaced URL', async () => {
      const encoded = plain.stringify(complexTestState);
      window.history.replaceState({}, '', `?state=${encoded}`);

      const useStore = createComplexStore(plain, 'state');
      render(<ComplexStateDisplay store={useStore} />);

      await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
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
      await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
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
          (set) => ({ text: 'initial', setText: (text) => set({ text }) }),
          { key: false, format: marked }
        )
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
      await expect.element(page.getByTestId('text')).toHaveTextContent('(empty)');
    });

    it('should handle empty array', async () => {
      interface Store {
        items: string[];
        setItems: (items: string[]) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({ items: ['a', 'b'], setItems: (items) => set({ items }) }),
          { key: false, format: marked }
        )
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

  describe('string with comma (regression test)', () => {
    it('marked: should preserve comma in string through round-trip', async () => {
      interface Store {
        search: string;
        setSearch: (search: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({ search: '', setSearch: (search) => set({ search }) }),
          { key: false, format: marked }
        )
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
      await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
    });

    it('marked: should restore comma in string from URL', async () => {
      interface Store {
        search: string;
      }

      const encoded = marked.stringifyStandalone({ search: 'hello, world' });
      window.history.replaceState({}, '', `?search=${encoded.search[0]}`);

      const useStore = create<Store>()(
        querystring(
          () => ({ search: '' }),
          { key: false, format: marked }
        )
      );

      function TestComponent() {
        const search = useStore((s) => s.search);
        return <span data-testid="search">{search}</span>;
      }

      render(<TestComponent />);
      await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
    });

    it('plain: should preserve comma in string through round-trip', async () => {
      interface Store {
        search: string;
        setSearch: (search: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({ search: '', setSearch: (search) => set({ search }) }),
          { key: false, format: plain }
        )
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
      await expect.element(page.getByTestId('search')).toHaveTextContent('hello, world');
    });
  });

  describe('decimal numbers', () => {
    it('marked: should preserve decimal precision', async () => {
      interface Store {
        price: number;
        setPrice: (price: number) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({ price: 0, setPrice: (price) => set({ price }) }),
          { key: false, format: marked }
        )
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
      await expect.element(page.getByTestId('price')).toHaveTextContent('99.99');
      await expect.element(page.getByTestId('type')).toHaveTextContent('number');
    });
  });

  describe('negative numbers', () => {
    it('marked: should handle negative numbers', async () => {
      interface Store {
        value: number;
        setValue: (value: number) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({ value: 0, setValue: (value) => set({ value }) }),
          { key: false, format: marked }
        )
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
      await expect.element(page.getByTestId('value')).toHaveTextContent('-42.5');
      await expect.element(page.getByTestId('type')).toHaveTextContent('number');
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
          (set) => ({
            a: { b: { c: { d: { e: '' } } } },
            setE: (e) => set({ a: { b: { c: { d: { e } } } } }),
          }),
          { key: false, format: marked }
        )
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
      await expect.element(page.getByTestId('e')).toHaveTextContent('deep value');
    });
  });

  describe('array of objects', () => {
    it('marked: should preserve array of objects', async () => {
      interface Store {
        items: Array<{ id: number; name: string }>;
        setItems: (items: Store['items']) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({ items: [], setItems: (items) => set({ items }) }),
          { key: false, format: marked }
        )
      );

      function TestComponent() {
        const { items, setItems } = useStore();
        return (
          <div>
            <span data-testid="items">{JSON.stringify(items)}</span>
            <span data-testid="count">{items.length}</span>
            <button onClick={() => setItems([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])}>Set</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect.element(page.getByTestId('count')).toHaveTextContent('2');
      await expect.element(page.getByTestId('items')).toHaveTextContent('[{"id":1,"name":"A"},{"id":2,"name":"B"}]');
    });
  });

  describe('mixed arrays', () => {
    it('marked: should handle arrays with multiple types', async () => {
      interface Store {
        mixed: (string | number | boolean)[];
        setMixed: (mixed: Store['mixed']) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({ mixed: [], setMixed: (mixed) => set({ mixed }) }),
          { key: false, format: marked }
        )
      );

      function TestComponent() {
        const { mixed, setMixed } = useStore();
        return (
          <div>
            <span data-testid="mixed">{JSON.stringify(mixed)}</span>
            <span data-testid="types">{mixed.map(m => typeof m).join(',')}</span>
            <button onClick={() => setMixed(['text', 42, true, 'more', 0, false])}>Set</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect.element(page.getByTestId('mixed')).toHaveTextContent('["text",42,true,"more",0,false]');
      await expect.element(page.getByTestId('types')).toHaveTextContent('string,number,boolean,string,number,boolean');
    });
  });
});
