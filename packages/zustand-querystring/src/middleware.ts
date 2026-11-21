import {
  isEmpty,
  isEqual,
  isObjectLike,
  isPlainObject,
  mergeWith,
  pickBy,
} from 'lodash-es';
import { StateCreator, StoreMutatorIdentifier } from 'zustand/vanilla';
import { marked as markedFormat } from './format/marked.js';
import type {
  QueryStringFormat,
  QueryStringFormatFor,
  QueryStringParams,
} from './format/types.js';

export type {
  ParseContext,
  QueryStringFormat,
  QueryStringFormatFor,
  QueryStringFormatNamespaced,
  QueryStringFormatStandalone,
  QueryStringParams,
} from './format/types.js';

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
        const fields = compact(
          newValue,
          {},
          syncNull,
          syncUndefined,
          Object.keys(newValue),
        ).output;
        // An object whose every field the flags leave out is left out too.
        if (!isEmpty(fields) || isEmpty(newValue)) {
          output[key] = fields;
        }
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
    }
  });

  return { output };
};

// A partial state leaves out an object none of whose fields are selected, unless it is empty.
const translateSelectionToState = <T>(
  selection: DeepSelect<T>,
  state: T,
  partial = false,
) => {
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
      const selected = translateSelectionToState(value, state[key], partial);
      if (!partial || !isEmpty(selected) || isEqual(state[key], {})) {
        acc[key] = selected;
      }
    }
    return acc;
  }, {} as T);
};

// A function, or a plain object holding one at any depth.
const holdsFunction = (value: unknown): boolean =>
  typeof value === 'function' ||
  (isPlainObject(value) && Object.values(value as object).some(holdsFunction));

// The params of a search in order, as raw text; a param without a value has none.
const splitSearch = (search: string) =>
  search
    .slice(search.startsWith('?') ? 1 : 0)
    .split('&')
    .filter(Boolean)
    .map(param => {
      const eqIndex = param.indexOf('=');
      return eqIndex === -1
        ? { param, key: param }
        : {
            param,
            key: param.slice(0, eqIndex),
            value: param.slice(eqIndex + 1),
          };
    });

const parseSearchString = (search: string): QueryStringParams => {
  const result: QueryStringParams = {};

  splitSearch(search).forEach(({ key, value }) => {
    if (value === undefined) return;
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(value);
  });

  return result;
};

// Writes the params into a search: an owned param takes its next value in place, or is removed; others stay as they are.
const rewriteSearch = (
  search: string,
  owned: Set<string>,
  params: QueryStringParams,
) => {
  const valuesToWrite = new Map(
    Object.entries(params).map(([key, values]) => [key, [...values]]),
  );
  const result: string[] = [];

  splitSearch(search).forEach(({ param, key }) => {
    if (!owned.has(key)) {
      // Not ours - keep as-is
      result.push(param);
      return;
    }

    // Our key - if we have values to write, take one from the front
    const values = valuesToWrite.get(key);
    if (values && values.length > 0) {
      result.push(`${key}=${values.shift()}`);
    }
    // If no more values, skip (removed)
  });

  // Add remaining values at the end in stringify order (new additions)
  valuesToWrite.forEach((values, key) => {
    values.forEach(value => result.push(`${key}=${value}`));
  });

  return result.length ? '?' + result.join('&') : '';
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

  const getSelectedState = (state, pathname, partial = false) => {
    if (defaultedOptions.select) {
      const selection = defaultedOptions.select(pathname);
      const selectedState = translateSelectionToState(
        selection,
        state,
        partial,
      );
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

  // The selected state in URL shape for a pathname.
  const urlStateOf = (state, pathname: string): object =>
    applyMapTo(getSelectedState(state, pathname), pathname);

  /** Apply map.from if configured, otherwise pass through */
  const applyMapFrom = (urlState: object, pathname: string): object => {
    return map ? map.from(urlState, pathname) : urlState;
  };

  // URL state replaces the values it carries, arrays, an empty object over a plain one, and undefined with syncUndefined; a plain object merges key by key, into a class instance itself, which a navigation leaves as it is.
  const mergeUrlState = (
    state: object,
    urlState: object,
    navigation = false,
  ) => {
    const merged = isPlainObject(state) ? { ...state } : state;
    for (const [key, value] of Object.entries(urlState)) {
      if (value === undefined && !defaultedOptions.syncUndefined) continue;
      const current = merged[key];
      if (
        navigation &&
        Object.prototype.hasOwnProperty.call(merged, key) &&
        holdsFunction(current) &&
        (typeof current === 'function' ||
          !isPlainObject(value) ||
          isEmpty(value))
      )
        continue;
      if (
        isPlainObject(value) &&
        isObjectLike(current) &&
        !Array.isArray(current)
      ) {
        if (navigation && !isPlainObject(current)) continue;
        merged[key] =
          isEmpty(value) && isPlainObject(current)
            ? value
            : mergeUrlState(current, value, navigation);
      } else {
        merged[key] = value;
      }
    }
    return merged;
  };

  let initialState: ReturnType<typeof fn>;

  // The initial state in URL shape: the parse hints and the diff baseline.
  const urlDefaults = (pathname: string): object =>
    urlStateOf(initialState, pathname);

  // The params this store writes for a state in URL shape.
  const ownedKeys = (urlState: object) =>
    new Set(
      standalone
        ? Object.keys(format.stringifyStandalone(urlState)).map(
            key => defaultedOptions.prefix + key,
          )
        : [defaultedOptions.prefix + (defaultedOptions.key as string)],
    );

  const initialize = (url: URL, state, navigation = false) => {
    try {
      const stateFromUrl = getStateFromUrl(url, urlDefaults(url.pathname));
      if (!stateFromUrl) {
        return state;
      }
      // stateFromUrl is in URL shape — map.from converts it back to store shape
      const storeState = applyMapFrom(stateFromUrl, url.pathname);
      const selected = getSelectedState(storeState, url.pathname, true);
      return mergeUrlState(state, selected, navigation);
    } catch (error) {
      console.error('[initialize] error:', error);
      return state;
    }
  };

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

  const withDefaults = (state, partial) =>
    mergeWith({}, state, partial, (_objValue, srcValue) => {
      if (Array.isArray(srcValue)) {
        return srcValue;
      }
      return undefined;
    });

  // @ts-ignore - typed via StoreMutators augmentation
  api.setDefaults = (partial: Partial<typeof initialState>) => {
    initialState = withDefaults(initialState, partial);
  };

  // A setDefaults call inside the initializer applies to the state it returns.
  const createState = (setState: typeof set) => {
    const state = fn(setState, get, api);
    initialState = initialState ? withDefaults(state, initialState) : state;
    return state;
  };

  // @ts-ignore - typed via StoreMutators augmentation
  api.href = (pathname: string, partial: object = {}) => {
    const stateForUrl = urlStateOf({ ...get(), ...partial }, pathname);
    // Passed keys are written even at their initial value (with map, all keys), so a link can clear a filter.
    const passed = getSelectedState(partial, pathname, true);
    const forced = Object.keys(map && !isEmpty(passed) ? stateForUrl : passed);
    const { output } = compact(
      stateForUrl,
      urlDefaults(pathname),
      defaultedOptions.syncNull,
      defaultedOptions.syncUndefined,
      forced,
    );
    // Encoded like the store's own write, so a # in a value stays in the query.
    const query = new URL('http://localhost');
    query.search = rewriteSearch('', new Set(), toParams(output));
    return pathname + query.search;
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
    const state = createState(withUrl(set));

    // Track previously managed URL keys so we can remove orphaned params
    // when dynamic state keys disappear (e.g., filters reset from populated to {}).
    let previouslyManagedKeys = new Set<string>();

    // The URL this store last wrote or read; any other URL is a navigation.
    let lastUrl = location.pathname + location.search;
    // A read owes a URL write, creation's too; a timer pays it 100ms later while the store has a subscriber.
    let writeOwed = true;
    let writeTimer: ReturnType<typeof setTimeout> | undefined;
    // React may create a store twice and keep one, and unmount it later; only a subscribed store follows the URL.
    let subscribers = 0;
    const armWrite = () => {
      clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        readUrl();
        if (subscribers > 0) setQuery();
      }, 100);
    };
    const readUrl = () => {
      if (location.pathname + location.search === lastUrl) return;
      lastUrl = location.pathname + location.search;
      writeOwed = true;
      if (subscribers > 0) armWrite();
      const current = get() as Record<string, unknown>;
      // A navigation never replaces a function, like an action, nor an object holding one at any depth with anything but a non-empty plain object.
      const next = initialize(new URL(location.href), current, true);
      // Only changed keys, so the others keep their references; a key the state lacks is set from the store's own key, prefix or select.
      // An instance, like one map.from returns, is changed unless it is the same one: isEqual may not see its fields.
      const changed = pickBy(next, (value, key) =>
        key in current
          ? isObjectLike(value) &&
            !isPlainObject(value) &&
            !Array.isArray(value)
            ? value !== current[key]
            : !isEqual(value, current[key])
          : !standalone ||
            Boolean(defaultedOptions.prefix || defaultedOptions.select),
      );
      if (!isEmpty(changed)) set(changed as Parameters<typeof set>[0]);
    };

    const setQuery = () => {
      readUrl();
      // Paid before the write, so a write that throws isn't owed again.
      writeOwed = false;
      clearTimeout(writeTimer);
      const url = new URL(window.location.href);
      const stateForUrl = urlStateOf(get(), url.pathname);
      const { output: newCompacted } = compact(
        stateForUrl,
        urlDefaults(url.pathname),
        defaultedOptions.syncNull,
        defaultedOptions.syncUndefined,
      );
      const previous = url.search;

      const currentKeys = ownedKeys(stateForUrl);
      // managedKeys = current keys ∪ previously managed keys
      // This ensures that when dynamic keys disappear (e.g., filters: {} → no sub-keys),
      // the old URL params are still recognized as ours and get removed.
      const managedKeys = new Set([
        ...Array.from(currentKeys),
        ...Array.from(previouslyManagedKeys),
      ]);
      previouslyManagedKeys = currentKeys;
      url.search = rewriteSearch(
        url.search,
        managedKeys,
        toParams(newCompacted),
      );

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
    const initialized = initialize(new URL(window.location.href), state);
    // Seed previouslyManagedKeys from the initialized (URL-merged) state so that
    // if the user's first action is clearing dynamic keys, they can still be removed.
    previouslyManagedKeys = ownedKeys(
      urlStateOf(initialized, location.pathname),
    );
    api.getInitialState = () => initialized;
    return initialized;
  } else if (defaultedOptions.url) {
    const initialized = initialize(
      new URL(defaultedOptions.url, 'http://localhost'),
      createState(set),
    );
    api.getInitialState = () => initialized;
    return initialized;
  }

  return createState(set);
};

export const querystring = queryStringImpl as unknown as QueryString;
