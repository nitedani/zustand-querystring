/**
 * Browser tests for configurable format URL encoding/decoding.
 * These tests run in an actual browser with real React components and URL APIs.
 * They verify that state survives the full round-trip: state → URL → state
 * 
 * Tests cover all 4 combinations:
 * - flat + standalone (typed: false, key: false)
 * - flat + namespaced (typed: false, key: 'state')
 * - compact + standalone (typed: true, key: false)
 * - compact + namespaced (typed: true, key: 'state')
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { create } from 'zustand';
import { querystring } from './middleware.js';
import { createFormat } from './format/configurable.js';

// Clean up URL before each test
beforeEach(() => {
  window.history.replaceState({}, '', window.location.pathname);
});

describe('Configurable format browser tests', () => {
  
  describe('flat + standalone (typed: false, key: false)', () => {
    const format = createFormat({ typed: false });

    it('should round-trip string with spaces', async () => {
      interface Store {
        name: string;
        setName: (name: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({
            name: '',
            setName: (name) => set({ name }),
          }),
          { key: false, format }
        )
      );

      function TestComponent() {
        const name = useStore((s) => s.name);
        const setName = useStore((s) => s.setName);
        return (
          <div>
            <span data-testid="name">{name}</span>
            <button onClick={() => setName('John Doe')}>Set Name</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set Name' }).click();
      await expect.element(page.getByTestId('name')).toHaveTextContent('John Doe');
      expect(window.location.search).toContain('name=');
    });

    it('should round-trip unicode and special characters', async () => {
      interface Store {
        text: string;
        setText: (text: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({
            text: '',
            setText: (text) => set({ text }),
          }),
          { key: false, format }
        )
      );

      function TestComponent() {
        const text = useStore((s) => s.text);
        const setText = useStore((s) => s.setText);
        return (
          <div>
            <span data-testid="text">{text}</span>
            <button onClick={() => setText('你好 😀 100%')}>Set Text</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set Text' }).click();
      await expect.element(page.getByTestId('text')).toHaveTextContent('你好 😀 100%');
    });

    it('should restore state from URL on mount', async () => {
      interface Store { name: string; }

      const stringified = format.stringifyStandalone({ name: 'Jane Doe' });
      const urlValue = typeof stringified.name === 'string' ? stringified.name : stringified.name[0];
      window.history.replaceState({}, '', `?name=${urlValue}`);

      const useStore = create<Store>()(
        querystring(() => ({ name: '' }), { key: false, format })
      );

      function TestComponent() {
        return <span data-testid="name">{useStore((s) => s.name)}</span>;
      }

      render(<TestComponent />);
      await expect.element(page.getByTestId('name')).toHaveTextContent('Jane Doe');
    });

    it('should preserve number type', async () => {
      interface Store {
        count: number;
        setCount: (count: number) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({ count: 0, setCount: (count) => set({ count }) }),
          { key: false, format }
        )
      );

      function TestComponent() {
        const count = useStore((s) => s.count);
        return (
          <div>
            <span data-testid="count">{count}</span>
            <span data-testid="type">{typeof count}</span>
            <button onClick={() => useStore.getState().setCount(42)}>Set</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect.element(page.getByTestId('count')).toHaveTextContent('42');
      await expect.element(page.getByTestId('type')).toHaveTextContent('number');
    });
  });

  describe('flat + namespaced (typed: false, key: "state")', () => {
    const format = createFormat({ typed: false });

    it('should round-trip string with spaces in single param', async () => {
      // Clean URL to ensure no leftover params from previous tests
      window.history.replaceState({}, '', window.location.pathname);
      
      interface Store {
        name: string;
        setName: (name: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({
            name: '',
            setName: (name) => set({ name }),
          }),
          { key: 'state', format }
        )
      );

      function TestComponent() {
        const name = useStore((s) => s.name);
        const setName = useStore((s) => s.setName);
        return (
          <div>
            <span data-testid="name">{name}</span>
            <button onClick={() => setName('John Doe')}>Set Name</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set Name' }).click();
      await expect.element(page.getByTestId('name')).toHaveTextContent('John Doe');
      expect(window.location.search).toContain('state=');
    });

    it('should round-trip unicode and special characters', async () => {
      interface Store {
        text: string;
        setText: (text: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({
            text: '',
            setText: (text) => set({ text }),
          }),
          { key: 'state', format }
        )
      );

      function TestComponent() {
        const text = useStore((s) => s.text);
        const setText = useStore((s) => s.setText);
        return (
          <div>
            <span data-testid="text">{text}</span>
            <button onClick={() => setText('你好 😀 100%')}>Set Text</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set Text' }).click();
      await expect.element(page.getByTestId('text')).toHaveTextContent('你好 😀 100%');
    });

    it('should restore state from URL on mount', async () => {
      interface Store { name: string; count: number; }

      const stringified = format.stringify({ name: 'Jane', count: 42 });
      window.history.replaceState({}, '', `?state=${stringified}`);

      const useStore = create<Store>()(
        querystring(() => ({ name: '', count: 0 }), { key: 'state', format })
      );

      function TestComponent() {
        const name = useStore((s) => s.name);
        const count = useStore((s) => s.count);
        return (
          <div>
            <span data-testid="name">{name}</span>
            <span data-testid="count">{count}</span>
            <span data-testid="type">{typeof count}</span>
          </div>
        );
      }

      render(<TestComponent />);
      await expect.element(page.getByTestId('name')).toHaveTextContent('Jane');
      await expect.element(page.getByTestId('count')).toHaveTextContent('42');
      await expect.element(page.getByTestId('type')).toHaveTextContent('number');
    });
  });

  describe('compact + standalone (typed: true, key: false)', () => {
    const format = createFormat({ typed: true });

    it('should round-trip string with spaces', async () => {
      interface Store {
        name: string;
        setName: (name: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({
            name: '',
            setName: (name) => set({ name }),
          }),
          { key: false, format }
        )
      );

      function TestComponent() {
        const name = useStore((s) => s.name);
        const setName = useStore((s) => s.setName);
        return (
          <div>
            <span data-testid="name">{name}</span>
            <button onClick={() => setName('John Doe')}>Set Name</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set Name' }).click();
      await expect.element(page.getByTestId('name')).toHaveTextContent('John Doe');
      expect(window.location.search).toContain('name=');
    });

    it('should preserve all types through round-trip', async () => {
      interface Store {
        name: string;
        count: number;
        active: boolean;
        setValues: () => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({
            name: '',
            count: 0,
            active: false,
            setValues: () => set({ name: 'Test', count: 42, active: true }),
          }),
          { key: false, format }
        )
      );

      function TestComponent() {
        const name = useStore((s) => s.name);
        const count = useStore((s) => s.count);
        const active = useStore((s) => s.active);
        const setValues = useStore((s) => s.setValues);
        return (
          <div>
            <span data-testid="name">{name}</span>
            <span data-testid="count">{count}</span>
            <span data-testid="count-type">{typeof count}</span>
            <span data-testid="active">{String(active)}</span>
            <span data-testid="active-type">{typeof active}</span>
            <button onClick={setValues}>Set Values</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set Values' }).click();
      await expect.element(page.getByTestId('name')).toHaveTextContent('Test');
      await expect.element(page.getByTestId('count')).toHaveTextContent('42');
      await expect.element(page.getByTestId('count-type')).toHaveTextContent('number');
      await expect.element(page.getByTestId('active')).toHaveTextContent('true');
      await expect.element(page.getByTestId('active-type')).toHaveTextContent('boolean');
    });

    it('should restore typed values from URL on mount', async () => {
      interface Store { name: string; count: number; active: boolean; }

      const state = { name: 'Hello', count: 42, active: true };
      const stringified = format.stringifyStandalone(state);
      const parts: string[] = [];
      for (const [key, value] of Object.entries(stringified)) {
        parts.push(`${key}=${value}`);
      }
      window.history.replaceState({}, '', `?${parts.join('&')}`);

      const useStore = create<Store>()(
        querystring(() => ({ name: '', count: 0, active: false }), { key: false, format })
      );

      function TestComponent() {
        const name = useStore((s) => s.name);
        const count = useStore((s) => s.count);
        const active = useStore((s) => s.active);
        return (
          <div>
            <span data-testid="name">{name}</span>
            <span data-testid="count">{count}</span>
            <span data-testid="count-type">{typeof count}</span>
            <span data-testid="active">{String(active)}</span>
            <span data-testid="active-type">{typeof active}</span>
          </div>
        );
      }

      render(<TestComponent />);
      await expect.element(page.getByTestId('name')).toHaveTextContent('Hello');
      await expect.element(page.getByTestId('count')).toHaveTextContent('42');
      await expect.element(page.getByTestId('count-type')).toHaveTextContent('number');
      await expect.element(page.getByTestId('active')).toHaveTextContent('true');
      await expect.element(page.getByTestId('active-type')).toHaveTextContent('boolean');
    });

    it('should round-trip arrays', async () => {
      interface Store {
        items: string[];
        setItems: (items: string[]) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({ items: [], setItems: (items) => set({ items }) }),
          { key: false, format }
        )
      );

      function TestComponent() {
        const items = useStore((s) => s.items);
        return (
          <div>
            <span data-testid="items">{JSON.stringify(items)}</span>
            <button onClick={() => useStore.getState().setItems(['a', 'b', 'c'])}>Set</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect.element(page.getByTestId('items')).toHaveTextContent('["a","b","c"]');
    });
  });

  describe('compact + namespaced (typed: true, key: "state")', () => {
    const format = createFormat({ typed: true });

    it('should round-trip string with spaces in single param', async () => {
      // Clean URL to ensure no leftover params from previous tests
      window.history.replaceState({}, '', window.location.pathname);
      
      interface Store {
        name: string;
        setName: (name: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({
            name: '',
            setName: (name) => set({ name }),
          }),
          { key: 'state', format }
        )
      );

      function TestComponent() {
        const name = useStore((s) => s.name);
        const setName = useStore((s) => s.setName);
        return (
          <div>
            <span data-testid="name">{name}</span>
            <button onClick={() => setName('John Doe')}>Set Name</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set Name' }).click();
      await expect.element(page.getByTestId('name')).toHaveTextContent('John Doe');
      expect(window.location.search).toContain('state=');
    });

    it('should preserve all types through round-trip', async () => {
      interface Store {
        name: string;
        count: number;
        active: boolean;
        setValues: () => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({
            name: '',
            count: 0,
            active: false,
            setValues: () => set({ name: 'Test', count: 42, active: true }),
          }),
          { key: 'state', format }
        )
      );

      function TestComponent() {
        const name = useStore((s) => s.name);
        const count = useStore((s) => s.count);
        const active = useStore((s) => s.active);
        const setValues = useStore((s) => s.setValues);
        return (
          <div>
            <span data-testid="name">{name}</span>
            <span data-testid="count">{count}</span>
            <span data-testid="count-type">{typeof count}</span>
            <span data-testid="active">{String(active)}</span>
            <span data-testid="active-type">{typeof active}</span>
            <button onClick={setValues}>Set Values</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set Values' }).click();
      await expect.element(page.getByTestId('name')).toHaveTextContent('Test');
      await expect.element(page.getByTestId('count')).toHaveTextContent('42');
      await expect.element(page.getByTestId('count-type')).toHaveTextContent('number');
      await expect.element(page.getByTestId('active')).toHaveTextContent('true');
      await expect.element(page.getByTestId('active-type')).toHaveTextContent('boolean');
    });

    it('should restore typed values from URL on mount', async () => {
      interface Store { name: string; count: number; active: boolean; }

      const state = { name: 'Hello', count: 42, active: true };
      const stringified = format.stringify(state);
      window.history.replaceState({}, '', `?state=${stringified}`);

      const useStore = create<Store>()(
        querystring(() => ({ name: '', count: 0, active: false }), { key: 'state', format })
      );

      function TestComponent() {
        const name = useStore((s) => s.name);
        const count = useStore((s) => s.count);
        const active = useStore((s) => s.active);
        return (
          <div>
            <span data-testid="name">{name}</span>
            <span data-testid="count">{count}</span>
            <span data-testid="count-type">{typeof count}</span>
            <span data-testid="active">{String(active)}</span>
            <span data-testid="active-type">{typeof active}</span>
          </div>
        );
      }

      render(<TestComponent />);
      await expect.element(page.getByTestId('name')).toHaveTextContent('Hello');
      await expect.element(page.getByTestId('count')).toHaveTextContent('42');
      await expect.element(page.getByTestId('count-type')).toHaveTextContent('number');
      await expect.element(page.getByTestId('active')).toHaveTextContent('true');
      await expect.element(page.getByTestId('active-type')).toHaveTextContent('boolean');
    });

    it('should round-trip arrays', async () => {
      interface Store {
        items: string[];
        setItems: (items: string[]) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({ items: [], setItems: (items) => set({ items }) }),
          { key: 'state', format }
        )
      );

      function TestComponent() {
        const items = useStore((s) => s.items);
        return (
          <div>
            <span data-testid="items">{JSON.stringify(items)}</span>
            <button onClick={() => useStore.getState().setItems(['a', 'b', 'c'])}>Set</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set' }).click();
      await expect.element(page.getByTestId('items')).toHaveTextContent('["a","b","c"]');
    });

    it('should round-trip unicode and special characters', async () => {
      interface Store {
        text: string;
        setText: (text: string) => void;
      }

      const useStore = create<Store>()(
        querystring(
          (set) => ({
            text: '',
            setText: (text) => set({ text }),
          }),
          { key: 'state', format }
        )
      );

      function TestComponent() {
        const text = useStore((s) => s.text);
        const setText = useStore((s) => s.setText);
        return (
          <div>
            <span data-testid="text">{text}</span>
            <button onClick={() => setText('你好 😀 100%')}>Set Text</button>
          </div>
        );
      }

      render(<TestComponent />);
      await page.getByRole('button', { name: 'Set Text' }).click();
      await expect.element(page.getByTestId('text')).toHaveTextContent('你好 😀 100%');
    });
  });

  describe('advanced scenarios', () => {
    describe('nested objects', () => {
      it('should round-trip nested objects in standalone mode', async () => {
        const format = createFormat({ typed: true });
        
        interface Store {
          user: { name: string; settings: { theme: string } };
          setUser: (user: Store['user']) => void;
        }

        const useStore = create<Store>()(
          querystring(
            (set) => ({
              user: { name: '', settings: { theme: '' } },
              setUser: (user) => set({ user }),
            }),
            { key: false, format }
          )
        );

        function TestComponent() {
          const user = useStore((s) => s.user);
          return (
            <div>
              <span data-testid="name">{user.name}</span>
              <span data-testid="theme">{user.settings.theme}</span>
              <button onClick={() => useStore.getState().setUser({ name: 'John', settings: { theme: 'dark' } })}>Set</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set' }).click();
        await expect.element(page.getByTestId('name')).toHaveTextContent('John');
        await expect.element(page.getByTestId('theme')).toHaveTextContent('dark');
      });

      it('should round-trip nested objects in namespaced mode', async () => {
        window.history.replaceState({}, '', window.location.pathname);
        const format = createFormat({ typed: true });
        
        interface Store {
          user: { name: string; age: number };
          setUser: (user: Store['user']) => void;
        }

        const useStore = create<Store>()(
          querystring(
            (set) => ({
              user: { name: '', age: 0 },
              setUser: (user) => set({ user }),
            }),
            { key: 'state', format }
          )
        );

        function TestComponent() {
          const user = useStore((s) => s.user);
          return (
            <div>
              <span data-testid="name">{user.name}</span>
              <span data-testid="age">{user.age}</span>
              <span data-testid="age-type">{typeof user.age}</span>
              <button onClick={() => useStore.getState().setUser({ name: 'Jane', age: 25 })}>Set</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set' }).click();
        await expect.element(page.getByTestId('name')).toHaveTextContent('Jane');
        await expect.element(page.getByTestId('age')).toHaveTextContent('25');
        await expect.element(page.getByTestId('age-type')).toHaveTextContent('number');
      });
    });

    describe('dates', () => {
      it('should round-trip dates in compact standalone mode', async () => {
        const format = createFormat({ typed: true, serialize: { dates: 'timestamp' } });
        
        interface Store {
          created: Date;
          setCreated: (date: Date) => void;
        }

        const testDate = new Date('2024-06-15T12:00:00.000Z');

        const useStore = create<Store>()(
          querystring(
            (set) => ({
              created: new Date(0),
              setCreated: (date) => set({ created: date }),
            }),
            { key: false, format }
          )
        );

        function TestComponent() {
          const created = useStore((s) => s.created);
          return (
            <div>
              <span data-testid="timestamp">{created.getTime()}</span>
              <span data-testid="is-date">{String(created instanceof Date)}</span>
              <button onClick={() => useStore.getState().setCreated(testDate)}>Set</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set' }).click();
        await expect.element(page.getByTestId('timestamp')).toHaveTextContent(String(testDate.getTime()));
        await expect.element(page.getByTestId('is-date')).toHaveTextContent('true');
      });
    });

    describe('arrays with mixed types', () => {
      it('should round-trip array of numbers', async () => {
        const format = createFormat({ typed: true });
        
        interface Store {
          nums: number[];
          setNums: (nums: number[]) => void;
        }

        const useStore = create<Store>()(
          querystring(
            (set) => ({ nums: [], setNums: (nums) => set({ nums }) }),
            { key: false, format }
          )
        );

        function TestComponent() {
          const nums = useStore((s) => s.nums);
          return (
            <div>
              <span data-testid="nums">{JSON.stringify(nums)}</span>
              <span data-testid="types">{nums.map(n => typeof n).join(',')}</span>
              <button onClick={() => useStore.getState().setNums([1, 2, 3])}>Set</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set' }).click();
        await expect.element(page.getByTestId('nums')).toHaveTextContent('[1,2,3]');
        await expect.element(page.getByTestId('types')).toHaveTextContent('number,number,number');
      });

      it('should round-trip array of booleans', async () => {
        const format = createFormat({ typed: true });
        
        interface Store {
          flags: boolean[];
          setFlags: (flags: boolean[]) => void;
        }

        const useStore = create<Store>()(
          querystring(
            (set) => ({ flags: [], setFlags: (flags) => set({ flags }) }),
            { key: false, format }
          )
        );

        function TestComponent() {
          const flags = useStore((s) => s.flags);
          return (
            <div>
              <span data-testid="flags">{JSON.stringify(flags)}</span>
              <span data-testid="types">{flags.map(f => typeof f).join(',')}</span>
              <button onClick={() => useStore.getState().setFlags([true, false, true])}>Set</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set' }).click();
        await expect.element(page.getByTestId('flags')).toHaveTextContent('[true,false,true]');
        await expect.element(page.getByTestId('types')).toHaveTextContent('boolean,boolean,boolean');
      });
    });

    describe('prefix option', () => {
      it('should use prefix in standalone mode', async () => {
        const format = createFormat({ typed: true });
        
        interface Store {
          count: number;
          setCount: (count: number) => void;
        }

        const useStore = create<Store>()(
          querystring(
            (set) => ({ count: 0, setCount: (count) => set({ count }) }),
            { key: false, format, prefix: 'app_' }
          )
        );

        function TestComponent() {
          const count = useStore((s) => s.count);
          return (
            <div>
              <span data-testid="count">{count}</span>
              <button onClick={() => useStore.getState().setCount(42)}>Set</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set' }).click();
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        expect(window.location.search).toContain('app_count=');
      });

      it('should restore state from prefixed URL params', async () => {
        const format = createFormat({ typed: true });
        // Use the compact format marker :42 for the value
        window.history.replaceState({}, '', '?app_count=:42');

        interface Store { count: number; }

        const useStore = create<Store>()(
          querystring(() => ({ count: 0 }), { key: false, format, prefix: 'app_' })
        );

        function TestComponent() {
          const count = useStore((s) => s.count);
          return (
            <div>
              <span data-testid="count">{count}</span>
              <span data-testid="type">{typeof count}</span>
            </div>
          );
        }

        render(<TestComponent />);
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect.element(page.getByTestId('type')).toHaveTextContent('number');
      });
    });

    describe('select option', () => {
      it('should only sync selected fields', async () => {
        window.history.replaceState({}, '', window.location.pathname);
        const format = createFormat({ typed: true });
        
        interface Store {
          name: string;
          count: number;
          secret: string;
          setAll: (name: string, count: number, secret: string) => void;
        }

        const useStore = create<Store>()(
          querystring(
            (set) => ({
              name: '',
              count: 0,
              secret: 'hidden',
              setAll: (name, count, secret) => set({ name, count, secret }),
            }),
            { 
              key: false, 
              format,
              select: () => ({ name: true, count: true })  // Don't sync 'secret'
            }
          )
        );

        function TestComponent() {
          const name = useStore((s) => s.name);
          const count = useStore((s) => s.count);
          const secret = useStore((s) => s.secret);
          return (
            <div>
              <span data-testid="name">{name}</span>
              <span data-testid="count">{count}</span>
              <span data-testid="secret">{secret}</span>
              <button onClick={() => useStore.getState().setAll('John', 42, 'password123')}>Set</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set' }).click();
        await expect.element(page.getByTestId('name')).toHaveTextContent('John');
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
        await expect.element(page.getByTestId('secret')).toHaveTextContent('password123');
        // secret should NOT be in URL
        expect(window.location.search).not.toContain('secret');
        expect(window.location.search).toContain('name=');
        expect(window.location.search).toContain('count=');
      });
    });

    describe('flat format specific', () => {
      it('should round-trip arrays in flat standalone mode with repeat separator', async () => {
        const format = createFormat({ typed: false, separators: { array: 'repeat' } });
        
        interface Store {
          tags: string[];
          setTags: (tags: string[]) => void;
        }

        const useStore = create<Store>()(
          querystring(
            (set) => ({ tags: [], setTags: (tags) => set({ tags }) }),
            { key: false, format }
          )
        );

        function TestComponent() {
          const tags = useStore((s) => s.tags);
          return (
            <div>
              <span data-testid="tags">{JSON.stringify(tags)}</span>
              <button onClick={() => useStore.getState().setTags(['a', 'b', 'c'])}>Set</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set' }).click();
        await expect.element(page.getByTestId('tags')).toHaveTextContent('["a","b","c"]');
        // With repeat separator, URL should have multiple tags params
        expect(window.location.search.match(/tags=/g)?.length).toBe(3);
      });

      it('should round-trip arrays in flat standalone mode with comma separator', async () => {
        const format = createFormat({ typed: false, separators: { array: ',' } });
        
        interface Store {
          tags: string[];
          setTags: (tags: string[]) => void;
        }

        const useStore = create<Store>()(
          querystring(
            (set) => ({ tags: [], setTags: (tags) => set({ tags }) }),
            { key: false, format }
          )
        );

        function TestComponent() {
          const tags = useStore((s) => s.tags);
          return (
            <div>
              <span data-testid="tags">{JSON.stringify(tags)}</span>
              <button onClick={() => useStore.getState().setTags(['x', 'y', 'z'])}>Set</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set' }).click();
        await expect.element(page.getByTestId('tags')).toHaveTextContent('["x","y","z"]');
        // With comma separator, URL should have single tags param with comma-separated values
        expect(window.location.search.match(/tags=/g)?.length).toBe(1);
        // Commas may or may not be URL-encoded depending on browser
        expect(window.location.search).toMatch(/x[,%2C]y[,%2C]z/);
      });
    });

    describe('error handling', () => {
      it('should handle malformed URL gracefully', async () => {
        const format = createFormat({ typed: true });
        // Set a malformed state param that can't be parsed
        window.history.replaceState({}, '', '?state=invalid{{{');

        interface Store { count: number; }

        const useStore = create<Store>()(
          querystring(() => ({ count: 42 }), { key: 'state', format })
        );

        function TestComponent() {
          const count = useStore((s) => s.count);
          return <span data-testid="count">{count}</span>;
        }

        render(<TestComponent />);
        // Should fall back to initial state
        await expect.element(page.getByTestId('count')).toHaveTextContent('42');
      });
    });

    describe('empty and special values', () => {
      it('should handle empty string', async () => {
        const format = createFormat({ typed: true });
        
        interface Store {
          text: string;
          setText: (text: string) => void;
        }

        const useStore = create<Store>()(
          querystring(
            (set) => ({ text: 'initial', setText: (text) => set({ text }) }),
            { key: false, format }
          )
        );

        function TestComponent() {
          const text = useStore((s) => s.text);
          return (
            <div>
              <span data-testid="text">{text || '(empty)'}</span>
              <span data-testid="length">{text.length}</span>
              <button onClick={() => useStore.getState().setText('')}>Set Empty</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set Empty' }).click();
        await expect.element(page.getByTestId('text')).toHaveTextContent('(empty)');
        await expect.element(page.getByTestId('length')).toHaveTextContent('0');
      });

      it('should handle empty array', async () => {
        const format = createFormat({ typed: true });
        
        interface Store {
          items: string[];
          setItems: (items: string[]) => void;
        }

        const useStore = create<Store>()(
          querystring(
            (set) => ({ items: ['initial'], setItems: (items) => set({ items }) }),
            { key: false, format }
          )
        );

        function TestComponent() {
          const items = useStore((s) => s.items);
          return (
            <div>
              <span data-testid="items">{JSON.stringify(items)}</span>
              <button onClick={() => useStore.getState().setItems([])}>Set Empty</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set Empty' }).click();
        await expect.element(page.getByTestId('items')).toHaveTextContent('[]');
      });
    });

    describe('booleanStyle number', () => {
      it('should round-trip booleans with number style', async () => {
        const format = createFormat({ typed: true, serialize: { booleans: 'number' } });
        
        interface Store {
          active: boolean;
          setActive: (active: boolean) => void;
        }

        const useStore = create<Store>()(
          querystring(
            (set) => ({ active: false, setActive: (active) => set({ active }) }),
            { key: false, format }
          )
        );

        function TestComponent() {
          const active = useStore((s) => s.active);
          return (
            <div>
              <span data-testid="active">{String(active)}</span>
              <span data-testid="type">{typeof active}</span>
              <button onClick={() => useStore.getState().setActive(true)}>Set True</button>
            </div>
          );
        }

        render(<TestComponent />);
        await page.getByRole('button', { name: 'Set True' }).click();
        await expect.element(page.getByTestId('active')).toHaveTextContent('true');
        await expect.element(page.getByTestId('type')).toHaveTextContent('boolean');
        // Should serialize as :1 in URL
        expect(window.location.search).toContain(':1');
      });
    });
  });
});
