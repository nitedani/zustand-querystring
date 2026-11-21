import { isEmpty, isEqual, isPlainObject, mergeWith, pickBy } from 'lodash-es';
import { StateCreator, StoreMutatorIdentifier } from 'zustand/vanilla';
import { marked as markedFormat } from './format/marked.js';

type Write<T, U> = Omit<T, keyof U> & U;

type WithQueryString<S, T> = Write<
  S,
  {
    setDefaults: (partial: Partial<T>) => void;
    href: (pathname: string, state?: Partial<T>) => string;
  }
>;

declare module 'zustand/vanilla' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface StoreMutators<S, A> {
    'zustand-querystring': WithQueryString<
      S,
      S extends { getState: () => infer T } ? T : never
    >;
  }
}

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
export type QueryStringFormat = QueryStringFormatNamespaced &
  QueryStringFormatStandalone;

/** Conditional format type based on key option */
export type QueryStringFormatFor<K extends string | false> = K extends false
  ? QueryStringFormatStandalone
  : QueryStringFormatNamespaced;

/**
 * Bidirectional mapping between store state and URL state.
 * `to` runs before serialization (store → URL), `from` after deserialization (URL → store).
 * U is inferred from `to`'s return type and flows into `from`'s parameter.
 */
export interface QueryStringMap<S, U extends object = Record<string, unknown>> {
  to: (state: S, pathname: string) => U;
  from: (urlState: U, pathname: string) => Partial<S>;
}

/** Helper to create a typed map — infers both S and U. Annotate `state` in `to` to provide S. */
export function createMap<S, U extends object>(
  map: QueryStringMap<S, U>,
): QueryStringMap<S, U> {
  return map;
}

export interface QueryStringOptions<
  T,
  K extends string | false = string | false,
> {
  url?: string;
  select?: (pathname: string) => DeepSelect<T>;
  key?: K;
  prefix?: string;
  format?: QueryStringFormatFor<K>;
  syncNull?: boolean;
  syncUndefined?: boolean;
  /** Bidirectional mapping between store state shape and URL state shape. */
  map?: QueryStringMap<T>;
}

type QueryString = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, [...Mps, ['zustand-querystring', never]], Mcs>,
  options?: QueryStringOptions<T>,
) => StateCreator<T, Mps, [['zustand-querystring', never], ...Mcs]>;

type QueryStringImpl = <T>(
  storeInitializer: StateCreator<T, [], []>,
  options?: QueryStringOptions<T>,
) => StateCreator<T, [], []>;

export const compact = (
  newState,
  initialState,
  syncNull = false,
  syncUndefined = false,
  // Keys kept even at their initial value; nothing inside them is compared.
  forced: string[] = [],
) => {
  const output = {};
  const removed: string[] = [];

  Object.keys(newState).forEach(key => {
    const newValue = newState[key];
    const initialValue = initialState[key];
    const isForced = forced.includes(key);

    if (
      typeof newValue !== 'function' &&
      (isForced || !isEqual(newValue, initialValue)) &&
      (syncNull || newValue !== null) &&
      (syncUndefined || newValue !== undefined)
    ) {
      const isPlainObject =
        typeof newValue === 'object' &&
        newValue !== null &&
        newValue !== undefined &&
        !Array.isArray(newValue) &&
        newValue.constructor === Object;

      if (isPlainObject && isForced) {
        output[key] = compact(
          newValue,
          {},
          syncNull,
          syncUndefined,
          Object.keys(newValue),
        ).output;
      } else if (
        isPlainObject &&
        initialValue &&
        typeof initialValue === 'object'
      ) {
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

// URL state replaces the values it carries, undefined too; plain objects merge key by key.
const mergeUrlState = (state: object, urlState: object) => {
  const merged = { ...state };
  for (const [key, value] of Object.entries(urlState)) {
    merged[key] =
      isPlainObject(value) && isPlainObject(merged[key])
        ? mergeUrlState(merged[key], value)
        : value;
  }
  return merged;
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
    key: false as string | false,
    prefix: '',
    format: markedFormat as QueryStringFormat,
    syncNull: false,
    syncUndefined: false,
    ...options,
  };

  // Ensure prefix is always a string (handles undefined from spread)
  if (defaultedOptions.prefix === undefined) {
    defaultedOptions.prefix = '';
  }

  // Cast format to full type - runtime checks ensure correct methods are called
  const format = defaultedOptions.format as QueryStringFormat;
  const standalone = defaultedOptions.key === false;

  const getStateFromUrl = (url: URL, initialState: object) => {
    const params = parseSearchString(url.search);

    if (standalone) {
      // Standalone mode: filter by prefix and strip it from keys
      let filteredParams = params;
      if (defaultedOptions.prefix) {
        filteredParams = {};
        for (const [key, values] of Object.entries(params)) {
          if (key.startsWith(defaultedOptions.prefix)) {
            filteredParams[key.slice(defaultedOptions.prefix.length)] = values;
          }
        }
      }
      // Format handles all params with initialState for type inference
      const result = format.parseStandalone(filteredParams, { initialState });
      return Object.keys(result).length > 0 ? result : null;
    } else {
      // Namespaced mode: look for prefix + key directly
      const fullKey =
        defaultedOptions.prefix + (defaultedOptions.key as string);
      const values = params[fullKey];
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

  // Widen to object-level types for internal use — the public API
  // (QueryStringOptions<T, K, U>) ensures type safety at the call site.
  const map = defaultedOptions.map as
    | QueryStringMap<object, object>
    | undefined;

  /** Apply map.to if configured, otherwise pass through */
  const applyMapTo = (state: object, pathname: string): object => {
    return map ? map.to(state, pathname) : state;
  };

  /** Apply map.from if configured, otherwise pass through */
  const applyMapFrom = (urlState: object, pathname: string): object => {
    return map ? map.from(urlState, pathname) : urlState;
  };

  const initialize = (url: URL, state) => {
    try {
      // When map is used, getStateFromUrl returns the URL-shape state.
      // We need the mapped initial state for type inference in parsing.
      const mappedInitial = applyMapTo(
        getSelectedState(initialState, url.pathname),
        url.pathname,
      );
      const stateFromUrl = getStateFromUrl(url, mappedInitial);
      if (!stateFromUrl) {
        return state;
      }
      // stateFromUrl is in URL shape — map.from converts it back to store shape
      const storeState = applyMapFrom(stateFromUrl, url.pathname);
      const selected = getSelectedState(storeState, url.pathname);
      return mergeUrlState(state, selected);
    } catch (error) {
      console.error('[initialize] error:', error);
      return state;
    }
  };

  let initialState: ReturnType<typeof fn>;

  // The mapped initial state for diffing when map is used
  const getMappedInitial = (pathname: string) => {
    if (defaultedOptions.map) {
      return applyMapTo(getSelectedState(initialState, pathname), pathname);
    }
    return initialState;
  };

  /** The URL params (with prefix) for a compacted state */
  const toParams = (compacted: object): QueryStringParams => {
    if (standalone) {
      const params: QueryStringParams = {};
      for (const [key, values] of Object.entries(
        format.stringifyStandalone(compacted),
      )) {
        params[defaultedOptions.prefix + key] = values;
      }
      return params;
    }
    return Object.keys(compacted).length > 0
      ? {
          [defaultedOptions.prefix + (defaultedOptions.key as string)]: [
            format.stringify(compacted),
          ],
        }
      : {};
  };

  // @ts-ignore - typed via StoreMutators augmentation
  api.href = (pathname: string, partial: object = {}) => {
    const stateForUrl = applyMapTo(
      getSelectedState({ ...get(), ...partial }, pathname),
      pathname,
    );
    // Passed keys are written even at their initial value (with map, all keys), so a link can clear a filter.
    const forced = Object.keys(
      map && !isEmpty(partial)
        ? stateForUrl
        : getSelectedState(partial, pathname),
    );
    const { output } = compact(
      stateForUrl,
      getMappedInitial(pathname),
      defaultedOptions.syncNull,
      defaultedOptions.syncUndefined,
      forced,
    );
    const pairs: string[] = [];
    for (const [key, values] of Object.entries(toParams(output))) {
      values.forEach(value => pairs.push(`${key}=${value}`));
    }
    return pathname + (pairs.length ? '?' + pairs.join('&') : '');
  };

  if (typeof window !== 'undefined') {
    // A change reads a navigation first, so it applies after it, then writes the URL.
    const withUrl =
      (apply: typeof set): typeof set =>
      (...args) => {
        readUrl();
        apply(...(args as Parameters<typeof set>));
        setQuery();
      };
    initialState = fn(withUrl(set), get, api);

    // Track previously managed URL keys so we can remove orphaned params
    // when dynamic state keys disappear (e.g., filters reset from populated to {}).
    let previouslyManagedKeys = new Set<string>();

    // @ts-ignore - typed via StoreMutators augmentation
    api.setDefaults = (partial: Partial<typeof initialState>) => {
      initialState = mergeWith(
        {},
        initialState,
        partial,
        (_objValue, srcValue) => {
          if (Array.isArray(srcValue)) {
            return srcValue;
          }
          return undefined;
        },
      );
    };

    // The URL this store last wrote or read; any other URL is a navigation.
    let lastUrl = '';
    // A navigation owes a URL write; a timer pays it 100ms later while the store has a subscriber.
    let writeOwed = false;
    let writeTimer: ReturnType<typeof setTimeout> | undefined;
    const armWrite = () => {
      clearTimeout(writeTimer);
      writeTimer = setTimeout(setQuery, 100);
    };
    const readUrl = () => {
      if (location.pathname + location.search === lastUrl) return;
      lastUrl = location.pathname + location.search;
      writeOwed = true;
      armWrite();
      const current = get() as Record<string, unknown>;
      const next = initialize(new URL(location.href), current);
      // Only changed keys, so the others keep their references; without select, only the store's own keys.
      const changed = pickBy(
        next,
        (value, key) =>
          (defaultedOptions.select || key in current) &&
          !isEqual(value, current[key]),
      );
      if (!isEmpty(changed)) set(changed as Parameters<typeof set>[0]);
    };

    const setQuery = () => {
      // Cleared first, so a write that throws isn't owed again.
      writeOwed = false;
      clearTimeout(writeTimer);
      readUrl();
      const url = new URL(window.location.href);
      const selectedState = getSelectedState(get(), url.pathname);
      // When map is used, transform to URL shape before compacting
      const stateForUrl = applyMapTo(selectedState, url.pathname);
      const mappedInitial = getMappedInitial(url.pathname);
      const { output: newCompacted } = compact(
        stateForUrl,
        mappedInitial,
        defaultedOptions.syncNull,
        defaultedOptions.syncUndefined,
      );
      const previous = url.search;

      // Get the managed keys based on mode
      let managedKeys: Set<string>;

      if (standalone) {
        // Stringify the full selected state to get all managed keys
        const allParams = format.stringifyStandalone(stateForUrl as object);
        const currentKeys = new Set(
          Object.keys(allParams).map(k => defaultedOptions.prefix + k),
        );

        // managedKeys = current keys ∪ previously managed keys
        // This ensures that when dynamic keys disappear (e.g., filters: {} → no sub-keys),
        // the old URL params are still recognized as ours and get removed.
        managedKeys = new Set([
          ...Array.from(currentKeys),
          ...Array.from(previouslyManagedKeys),
        ]);
        previouslyManagedKeys = currentKeys;
      } else {
        // Namespaced mode: single key (with prefix)
        const fullKey =
          defaultedOptions.prefix + (defaultedOptions.key as string);
        managedKeys = new Set([fullKey]);
      }
      const stateParams = toParams(newCompacted);

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
        const key = eqIndex === -1 ? param : param.slice(0, eqIndex);

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
      lastUrl = location.pathname + location.search;
    };

    // @ts-ignore
    if (!api.__ZUSTAND_QUERYSTRING_INIT__) {
      // @ts-ignore
      api.__ZUSTAND_QUERYSTRING_INIT__ = true;
      let frame = 0;
      const cb = () => {
        frame = requestAnimationFrame(cb);
        readUrl();
      };
      // React may create a store twice and keep one, and unmount it later; only a subscribed store follows the URL.
      let subscribers = 0;
      const originalSubscribe = api.subscribe;
      api.subscribe = (...args) => {
        if (subscribers++ === 0) {
          frame = requestAnimationFrame(cb);
          if (writeOwed) armWrite();
        }
        const unsubscribe = originalSubscribe(...args);
        let subscribed = true;
        return () => {
          if (subscribed && --subscribers === 0) {
            cancelAnimationFrame(frame);
            clearTimeout(writeTimer);
          }
          subscribed = false;
          unsubscribe();
        };
      };
    }
    api.setState = withUrl(api.setState);
    const initialized = initialize(new URL(window.location.href), initialState);
    // Seed previouslyManagedKeys from the initialized (URL-merged) state so that
    // if the user's first action is clearing dynamic keys, they can still be removed.
    if (standalone) {
      const initSelected = getSelectedState(
        initialized,
        new URL(window.location.href).pathname,
      );
      const initParams = format.stringifyStandalone(initSelected as object);
      previouslyManagedKeys = new Set(
        Object.keys(initParams).map(k => defaultedOptions.prefix + k),
      );
    }
    api.getInitialState = () => initialized;
    return initialized;
  } else if (defaultedOptions.url) {
    initialState = fn(set, get, api);
    const initialized = initialize(
      new URL(defaultedOptions.url, 'http://localhost'),
      initialState,
    );
    api.getInitialState = () => initialized;
    return initialized;
  }

  initialState = fn(set, get, api);
  return initialState;
};

export const querystring = queryStringImpl as unknown as QueryString;
