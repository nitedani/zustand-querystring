import { isEqual, mergeWith } from 'lodash-es';
import { StateCreator, StoreMutatorIdentifier } from 'zustand/vanilla';
import { json } from './parser.js';

type DeepSelect<T> = T extends object
  ? {
      [P in keyof T]?: DeepSelect<T[P]> | boolean;
    }
  : boolean;

export interface QueryStringParam {
  key: string;
  value: string | string[];
}

/** Record of key to array of values - always arrays for consistency */
export type QueryStringParams = Record<string, string[]>;

/** Format for namespaced mode (key is a string) */
export interface QueryStringFormatNamespaced {
  /** Serialize entire state into a single encoded string */
  stringify: (state: object) => string;
  /** Deserialize a single encoded string back to state */
  parse: (value: string, ctx?: ParseContext) => object;
}

/** Context passed to parse methods for type inference and future extensibility */
export interface ParseContext {
  /** Initial state for type inference */
  initialState: object;
}

/** Format for standalone mode (key is false) */
export interface QueryStringFormatStandalone {
  /** Serialize state into key-value pairs (always arrays for consistency) */
  stringifyStandalone: (state: object) => QueryStringParams;
  /** Deserialize key-value pairs back to state */
  parseStandalone: (params: QueryStringParams, ctx: ParseContext) => object;
}

/** Full format implementing both modes */
export type QueryStringFormat = QueryStringFormatNamespaced & QueryStringFormatStandalone;

/** Conditional format type based on key option */
export type QueryStringFormatFor<K extends string | false> = 
  K extends false 
    ? QueryStringFormatStandalone 
    : QueryStringFormatNamespaced;

export interface QueryStringOptions<T, K extends string | false = string | false> {
  url?: string;
  select?: (pathname: string) => DeepSelect<T>;
  key?: K;
  prefix?: string;
  format?: QueryStringFormatFor<K>;
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

const parseSearchString = (search: string): QueryStringParams => {
  const result: QueryStringParams = {};
  
  search
    .slice(search.startsWith('?') ? 1 : 0)
    .split('&')
    .filter(Boolean)
    .forEach(param => {
      const eqIndex = param.indexOf('=');
      if (eqIndex === -1) return;
      const key = param.slice(0, eqIndex);
      const value = param.slice(eqIndex + 1);
      
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(value);
    });
  
  return result;
};

const queryStringImpl: QueryStringImpl = (fn, options?) => (set, get, api) => {
  const defaultedOptions = {
    key: 'state' as string | false,
    prefix: '',
    format: json as QueryStringFormat,
    syncNull: false,
    syncUndefined: false,
    ...options,
  };

  // Cast format to full type - runtime checks ensure correct methods are called
  const format = defaultedOptions.format as QueryStringFormat;
  const standalone = defaultedOptions.key === false;

  const getStateFromUrl = (url: URL, initialState: object) => {
    let params = parseSearchString(url.search);
    
    // Filter by prefix and strip it from keys
    if (defaultedOptions.prefix) {
      const filtered: QueryStringParams = {};
      for (const [key, values] of Object.entries(params)) {
        if (key.startsWith(defaultedOptions.prefix)) {
          filtered[key.slice(defaultedOptions.prefix.length)] = values;
        }
      }
      params = filtered;
    }
    
    if (standalone) {
      // Standalone mode: format handles all params with initialState for type inference
      const result = format.parseStandalone(params, { initialState });
      return Object.keys(result).length > 0 ? result : null;
    } else {
      // Namespaced mode: find the key and parse its value
      const values = params[defaultedOptions.key as string];
      if (values && values.length > 0) {
        try {
          // Namespaced mode always has single value (not repeated keys)
          return format.parse(values[0], { initialState });
        } catch {
          return null;
        }
      }
      return null;
    }
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
      const stateFromUrl = getStateFromUrl(url, initialState);
      if (!stateFromUrl) {
        return initialState;
      }
      const selected = getSelectedState(stateFromUrl, url.pathname);
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

      // Get the key-value pairs based on mode
      let stateParams: QueryStringParams;
      let managedKeys: Set<string>;
      
      if (standalone) {
        // Stringify the full selected state to get all managed keys
        const allParams = format.stringifyStandalone(selectedState as object);
        managedKeys = new Set(Object.keys(allParams).map(k => defaultedOptions.prefix + k));
        
        // Stringify compacted state for values to write (with prefix)
        const compactedParams = format.stringifyStandalone(newCompacted);
        stateParams = {};
        for (const [key, values] of Object.entries(compactedParams)) {
          stateParams[defaultedOptions.prefix + key] = values;
        }
      } else {
        // Namespaced mode: single key
        if (Object.keys(newCompacted).length > 0) {
          stateParams = { [defaultedOptions.key as string]: [format.stringify(newCompacted)] };
        } else {
          stateParams = {};
        }
        managedKeys = new Set([defaultedOptions.key as string]);
      }

      // Build a map of key -> array of values to write
      const valuesToWrite = new Map<string, string[]>();
      const keyOrder: string[] = []; // Track key order
      for (const [key, values] of Object.entries(stateParams)) {
        valuesToWrite.set(key, [...values]);
        keyOrder.push(key);
      }

      const params = url.search.slice(1).split('&').filter(Boolean);
      const result: string[] = [];

      // Process existing params
      params.forEach(param => {
        const eqIndex = param.indexOf('=');
        if (eqIndex === -1) return;
        const key = param.slice(0, eqIndex);

        if (!managedKeys.has(key)) {
          // Not ours - keep as-is
          result.push(param);
          return;
        }

        // Our key - if we have values to write, take one from the front
        const values = valuesToWrite.get(key);
        if (values && values.length > 0) {
          const value = values.shift()!;
          result.push(`${key}=${value}`);
        }
        // If no more values, skip (removed)
      });

      // Add remaining values at the end in stringify order (new additions)
      for (const key of keyOrder) {
        const values = valuesToWrite.get(key);
        if (values) {
          values.forEach(v => result.push(`${key}=${v}`));
        }
      }

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
