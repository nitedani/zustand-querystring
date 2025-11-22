import { isEqual, mergeWith } from 'lodash-es';
import { StateCreator, StoreMutatorIdentifier } from 'zustand/vanilla';
import { parse, stringify } from './parser.js';

type DeepSelect<T> = T extends object
  ? {
      [P in keyof T]?: DeepSelect<T[P]> | boolean;
    }
  : boolean;

export interface QueryStringFormat {
  stringify: (value: any, standalone?: boolean) => string;
  parse: (value: string, standalone?: boolean) => any;
}

export interface QueryStringOptions<T> {
  url?: string;
  select?: (pathname: string) => DeepSelect<T>;
  key?: string | false;
  format?: QueryStringFormat;
  syncNull?: boolean;
  syncUndefined?: boolean;
}

type QueryString = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, Mps, Mcs>,
  options?: QueryStringOptions<T>,
) => StateCreator<T, Mps, Mcs>;

type QueryStringImpl = <T>(
  storeInitializer: StateCreator<T, [], []>,
  options?: QueryStringOptions<T>,
) => StateCreator<T, [], []>;

export const compact = (
  newState,
  initialState,
  syncNull = false,
  syncUndefined = false,
) => {
  const output = {};
  const removed: string[] = [];

  Object.keys(newState).forEach(key => {
    const newValue = newState[key];
    const initialValue = initialState[key];

    if (
      typeof newValue !== 'function' &&
      !isEqual(newValue, initialValue) &&
      (syncNull || newValue !== null) &&
      (syncUndefined || newValue !== undefined)
    ) {
      const isPlainObject =
        typeof newValue === 'object' &&
        newValue !== null &&
        newValue !== undefined &&
        !Array.isArray(newValue) &&
        newValue.constructor === Object;

      if (isPlainObject && initialValue && typeof initialValue === 'object') {
        const result = compact(newValue, initialValue, syncNull, syncUndefined);
        if (result.output && Object.keys(result.output).length > 0) {
          output[key] = result.output;
        }
      } else {
        output[key] = newValue;
      }
    } else {
      removed.push(key);
    }
  });

  return { output, removed };
};

const translateSelectionToState = <T>(selection: DeepSelect<T>, state: T) => {
  if (typeof state !== 'object' || !state) {
    return {};
  }
  return Object.keys(selection).reduce((acc, key) => {
    if (!(key in state)) {
      return acc;
    }
    const value = selection[key];
    if (typeof value === 'boolean') {
      if (value) {
        acc[key] = state[key];
      }
    } else {
      acc[key] = translateSelectionToState(value, state[key]);
    }
    return acc;
  }, {} as T);
};

const queryStringImpl: QueryStringImpl = (fn, options?) => (set, get, api) => {
  const defaultedOptions = {
    key: 'state' as string | false,
    format: {
      stringify,
      parse,
    },
    syncNull: false,
    syncUndefined: false,
    ...options,
  };

  const standalone = !defaultedOptions.key;

  // Track registered standalone keys globally to detect conflicts
  if (typeof window !== 'undefined' && standalone) {
    // @ts-ignore
    if (!window.__ZUSTAND_QUERYSTRING_KEYS__) {
      // @ts-ignore
      window.__ZUSTAND_QUERYSTRING_KEYS__ = new Map();
    }
  }

  const getStateFromUrl = (url: URL, initialState: any) => {
    if (standalone) {
      // Standalone mode: each state key is a separate query param
      const params = url.search.slice(1).split('&').filter(Boolean);
      const state = {};
      const initialKeys = new Set(Object.keys(initialState));

      params.forEach(param => {
        const eqIndex = param.indexOf('=');
        if (eqIndex === -1) return;
        const key = decodeURI(param.slice(0, eqIndex));
        const value = param.slice(eqIndex + 1);
        if (!initialKeys.has(key)) return;

        try {
          const parsed = defaultedOptions.format.parse(value, true);
          state[key] = parsed;
        } catch (error) {
          console.error('[getStateFromUrl] error parsing key:', key, error);
        }
      });
      return Object.keys(state).length > 0 ? state : null;
    }

    // Normal mode: single namespaced key
    const params = url.search.slice(1).split('&');
    for (const param of params) {
      const eqIndex = param.indexOf('=');
      if (eqIndex === -1) continue;
      const key = param.slice(0, eqIndex);
      if (key === defaultedOptions.key) {
        const value = param.slice(eqIndex + 1);
        const parsed = value
          ? defaultedOptions.format.parse(value, false)
          : null;
        return parsed;
      }
    }
    return null;
  };

  const getSelectedState = (state, pathname) => {
    if (defaultedOptions.select) {
      const selection = defaultedOptions.select(pathname);
      const selectedState = translateSelectionToState(selection, state);
      return selectedState;
    }
    return state ?? {};
  };

  const initialize = (url: URL, initialState) => {
    try {
      const stateFromURl = getStateFromUrl(url, initialState);
      if (!stateFromURl) {
        return initialState;
      }
      const selected = getSelectedState(stateFromURl, url.pathname);
      const merged = mergeWith(
        {},
        initialState,
        selected,
        (_objValue, srcValue) => {
          if (Array.isArray(srcValue)) {
            return srcValue;
          }
          return undefined;
        },
      );
      return merged;
    } catch (error) {
      console.error('[initialize] error:', error);
      return initialState;
    }
  };

  if (typeof window !== 'undefined') {
    const initialState = fn(
      (...args) => {
        set(...(args as Parameters<typeof set>));
        setQuery();
      },
      get,
      api,
    );

    // Validate standalone keys don't conflict
    if (standalone) {
      // @ts-ignore
      const registry = window.__ZUSTAND_QUERYSTRING_KEYS__;
      const stateKeys = Object.keys(initialState as object).filter(
        k => typeof (initialState as any)[k] !== 'function',
      );

      const conflicts: string[] = [];

      for (const key of stateKeys) {
        if (registry.has(key)) {
          const existing = registry.get(key);
          const current = defaultedOptions.format;
          // Allow same format, error on different formats
          if (existing !== current) {
            conflicts.push(key);
          }
        } else {
          registry.set(key, defaultedOptions.format);
        }
      }

      if (conflicts.length > 0) {
        throw new Error(
          `[zustand-querystring] Standalone mode conflict: Multiple stores are using the following keys with different formats: ${conflicts.map(k => `"${k}"`).join(', ')}. ` +
            `This will cause parsing errors. Please use unique state keys or the same format for all stores sharing keys.`,
        );
      }
    }

    const setQuery = () => {
      const url = new URL(window.location.href);
      const selectedState = getSelectedState(get(), url.pathname);
      const { output: newCompacted } = compact(
        selectedState,
        initialState,
        defaultedOptions.syncNull,
        defaultedOptions.syncUndefined,
      );
      const previous = url.search;

      const params = url.search.slice(1).split('&').filter(Boolean);

      // Determine which keys we manage and what values to write
      const managedKeys = standalone
        ? new Set(Object.keys(selectedState).map(encodeURI))
        : new Set([defaultedOptions.key as string]);

      const valuesToWrite = standalone
        ? new Map(
            Object.entries(newCompacted).map(([k, v]) => [encodeURI(k), v]),
          )
        : Object.keys(newCompacted).length
          ? new Map([[defaultedOptions.key as string, newCompacted]])
          : new Map();

      const result: string[] = [];

      // Process existing params: update ours, keep others
      params.forEach(p => {
        const key = p.split('=')[0];

        if (!managedKeys.has(key)) {
          // Not ours - keep as-is
          result.push(p);
          return;
        }

        // Our key - add if has value
        if (valuesToWrite.has(key)) {
          const encoded = defaultedOptions.format.stringify(
            valuesToWrite.get(key),
            standalone,
          );
          result.push(`${key}=${encoded}`);
          valuesToWrite.delete(key);
        }
        // If no value, it's compacted - skip it
      });

      // Add new keys not in URL
      valuesToWrite.forEach((value, key) => {
        const encoded = defaultedOptions.format.stringify(value, standalone);
        result.push(`${key}=${encoded}`);
      });

      url.search = result.length ? '?' + result.join('&') : '';

      if (url.search !== previous) {
        history.replaceState(history.state, '', url);
      }
    };

    // @ts-ignore
    if (!api.__ZUSTAND_QUERYSTRING_INIT__) {
      // @ts-ignore
      api.__ZUSTAND_QUERYSTRING_INIT__ = true;
      let previousPathname = '';
      const cb = () => {
        if (location.pathname !== previousPathname) {
          previousPathname = location.pathname;
          setTimeout(setQuery, 100);
        }
        requestAnimationFrame(cb);
      };
      requestAnimationFrame(cb);
    }
    const originalSetState = api.setState;
    api.setState = (...args) => {
      originalSetState(...(args as Parameters<typeof set>));
      setQuery();
    };
    const initialized = initialize(new URL(window.location.href), initialState);
    api.getInitialState = () => initialized;
    return initialized;
  } else if (defaultedOptions.url) {
    const initialized = initialize(
      new URL(defaultedOptions.url, 'http://localhost'),
      fn(set, get, api),
    );
    api.getInitialState = () => initialized;
    return initialized;
  }

  return fn(set, get, api);
};

export const querystring = queryStringImpl as unknown as QueryString;
