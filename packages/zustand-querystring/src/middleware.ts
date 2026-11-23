import {
  isDate,
  isEmpty,
  isEqual,
  isEqualWith,
  isMap,
  isObjectLike,
  isPlainObject,
  isRegExp,
  isSet,
  isTypedArray,
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
import { getOwn, setOwn } from './own.js';

export type {
  ParseContext,
  QueryStringFormat,
  QueryStringFormatFor,
  QueryStringFormatNamespaced,
  QueryStringFormatStandalone,
  QueryStringParam,
  QueryStringParams,
} from './format/types.js';

type Write<T, U> = Omit<T, keyof U> & U;

type WithQueryString<S, T> = Write<
  S,
  {
    setDefaults: (partial: Partial<T>) => void;
    /**
     * A URL for `pathname` with the initial state plus the fields of `state` that `select` syncs there. It leaves out the rest of the current state, though a custom `map` can write current values of fields you didn't pass.
     * Following the link applies the values in its query. To carry the current view, spread the current state: `href(pathname, { ...state, page: 2 })`.
     */
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
        // An object none of whose fields is written is left out too, unless it is empty.
        if (!isEmpty(fields) || isEmpty(newValue)) {
          output[key] = fields;
        }
      } else if (
        isPlainObject &&
        initialValue &&
        typeof initialValue === 'object'
      ) {
        const result = compact(newValue, initialValue, syncNull, syncUndefined);
        // An empty object over a non-empty default is kept, so a cleared filter stays cleared.
        if (!isEmpty(result.output) || isEmpty(newValue)) {
          output[key] = result.output;
        }
      } else {
        output[key] = newValue;
      }
    }
  });

  return { output };
};

// The fields of state that any of written holds, down to where one of them holds a whole value.
const pickFields = (state: object, written: object[]) => {
  const picked = {};
  for (const key of Object.keys(Object.assign({}, ...written))) {
    if (!Object.prototype.hasOwnProperty.call(state, key)) continue;
    const fields = written
      .filter(w => Object.prototype.hasOwnProperty.call(w, key))
      .map(w => w[key] as object);
    setOwn(
      picked,
      key,
      isPlainObject(state[key]) &&
        fields.every(f => isPlainObject(f) && !isEmpty(f))
        ? pickFields(state[key], fields)
        : state[key],
    );
  }
  return picked;
};

// A partial state leaves out an object none of whose fields are selected, unless it is empty.
const translateSelectionToState = <T>(
  selection: DeepSelect<T>,
  state: T,
  mode: 'full' | 'partial',
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
      const selected = translateSelectionToState(value, state[key], mode);
      if (mode === 'full' || !isEmpty(selected) || isEqual(state[key], {})) {
        acc[key] = selected;
      }
    }
    return acc;
  }, {} as T);
};

// A function, or a plain object holding one at any depth; an object it already saw, as in a cycle, holds none.
const holdsFunction = (value: unknown, seen = new Set<unknown>()): boolean => {
  if (typeof value === 'function') return true;
  if (!isPlainObject(value) || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value as object).some(v => holdsFunction(v, seen));
};

// An instance of a user class, which isEqual compares by its visible fields only, missing private ones.
const isInstance = (value: unknown) => {
  if (!isObjectLike(value) || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return (
    proto !== Object.prototype &&
    proto !== null &&
    !isDate(value) &&
    !isRegExp(value) &&
    !isMap(value) &&
    !isSet(value) &&
    !isTypedArray(value)
  );
};

// Deep equality where an instance, at any depth, equals only itself.
const isSameState = (a: unknown, b: unknown) =>
  isEqualWith(a, b, (x, y) =>
    isInstance(x) || isInstance(y) ? x === y : undefined,
  );

// The object without the fields a selection syncs; its other fields and its actions stay.
const clearSelected = (state: object, selection: object) => {
  const cleared = { ...state };
  for (const [key, selected] of Object.entries(selection)) {
    if (!Object.prototype.hasOwnProperty.call(cleared, key)) continue;
    if (isPlainObject(selected)) {
      if (isPlainObject(cleared[key])) {
        cleared[key] = clearSelected(cleared[key], selected);
      }
    } else if (selected && !holdsFunction(cleared[key])) {
      delete cleared[key];
    }
  }
  return cleared;
};

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
    const values = getOwn(result, key);
    if (values) values.push(value);
    else setOwn(result, key, [value]);
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

// URL state replaces what it carries; a plain object merges key by key, into a class instance itself unless it is a navigation.
// The selection is the one of the URL's pathname, or true where all of it is selected.
const mergeUrlState = (
  state: object,
  urlState: object,
  selection: Record<string, any> | true,
  { navigation = false, syncUndefined = false } = {},
) => {
  // Each URL object merged so far and its result, so a cycle in the URL state becomes the same cycle.
  const merges = new Map<object, object>();
  // keys is listed once per object: listing the keys of a large object walks all of them.
  const merge = (
    state: object,
    urlState: object,
    selection: Record<string, any> | true,
    keys: string[],
  ) => {
    const merged: Record<string, any> = isPlainObject(state)
      ? { ...state }
      : state;
    merges.set(urlState, merged);
    for (const key of keys) {
      // A __proto__ key would set the prototype of the copy zustand's setState makes.
      if (key === '__proto__') continue;
      const value = urlState[key];
      if (value === undefined && !syncUndefined) continue;
      const current = getOwn(merged, key);
      const selected = selection === true ? true : getOwn(selection, key);
      const valueKeys = isPlainObject(value) ? Object.keys(value) : undefined;
      const isEmptyObject = valueKeys?.length === 0;
      // An empty object over an object whose fields select syncs only some of clears just those.
      if (isEmptyObject && isPlainObject(current) && isPlainObject(selected)) {
        setOwn(merged, key, clearSelected(current, selected));
        continue;
      }
      // A URL never replaces a function, like an action, nor an object holding one at any depth with anything but a non-empty plain object.
      if (
        typeof current === 'function' ||
        ((!isPlainObject(value) || isEmptyObject) && holdsFunction(current))
      )
        continue;
      if (!isPlainObject(value)) {
        setOwn(merged, key, value);
        continue;
      }
      if (merges.has(value)) {
        setOwn(merged, key, merges.get(value));
        continue;
      }
      // A plain object merges into the object it lands on, or into a new one, so no two stores share the URL's object.
      const into =
        isObjectLike(current) &&
        !Array.isArray(current) &&
        !(isEmptyObject && isPlainObject(current))
          ? current
          : {};
      if (navigation && !isPlainObject(into)) continue;
      setOwn(
        merged,
        key,
        merge(
          into,
          value,
          isPlainObject(selected) ? selected : true,
          valueKeys!,
        ),
      );
    }
    return merged;
  };
  return merge(state, urlState, selection, Object.keys(urlState));
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
  const namespaceKey = defaultedOptions.prefix + defaultedOptions.key;
  // A parsed key the state lacks is the store's own only in its namespace, under its prefix or in its select.
  const ownsNewKeys =
    !standalone || Boolean(defaultedOptions.prefix || defaultedOptions.select);

  const getStateFromUrl = (url: URL, initialState: object) => {
    const params = parseSearchString(url.search);

    if (standalone) {
      // Standalone mode: filter by prefix and strip it from keys
      let filteredParams = params;
      if (defaultedOptions.prefix) {
        filteredParams = {};
        for (const [key, values] of Object.entries(params)) {
          if (key.startsWith(defaultedOptions.prefix)) {
            setOwn(
              filteredParams,
              key.slice(defaultedOptions.prefix.length),
              values,
            );
          }
        }
      }
      // Format handles all params with initialState for type inference
      const result = format.parseStandalone(filteredParams, { initialState });
      return Object.keys(result).length > 0 ? result : null;
    } else {
      // Namespaced mode: look for prefix + key directly
      const values = params[namespaceKey];
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

  const getSelectedState = (
    state,
    pathname,
    mode: 'full' | 'partial' = 'full',
  ) => {
    if (defaultedOptions.select) {
      return translateSelectionToState(
        defaultedOptions.select(pathname),
        state,
        mode,
      );
    }
    return state ?? {};
  };

  // Widen to object-level types for internal use — the public API
  // (QueryStringOptions<T, K, U>) ensures type safety at the call site.
  const map = defaultedOptions.map as
    | QueryStringMap<object, object>
    | undefined;

  // The selected state in URL shape for a pathname.
  const urlStateOf = (state, pathname: string): object => {
    const selected = getSelectedState(state, pathname);
    return map ? map.to(selected, pathname) : selected;
  };

  let initialState: ReturnType<typeof fn>;

  // The initial state in URL shape: the parse hints and the diff baseline.
  const urlDefaults = (pathname: string): object =>
    urlStateOf(initialState, pathname);

  // The state with a store-shaped state applied, as a navigation or the store's creation applies a URL.
  const applyState = (
    state,
    storeState,
    pathname: string,
    navigation: boolean,
  ) =>
    mergeUrlState(
      state,
      getSelectedState(storeState, pathname, 'partial'),
      defaultedOptions.select
        ? (defaultedOptions.select(pathname) as object)
        : true,
      { navigation, syncUndefined: defaultedOptions.syncUndefined },
    );

  const initialize = (url: URL, state, navigation = false) => {
    try {
      const stateFromUrl = getStateFromUrl(url, urlDefaults(url.pathname));
      if (!stateFromUrl) {
        return state;
      }
      // stateFromUrl is in URL shape — map.from converts it back to store shape
      const storeState = map
        ? map.from(stateFromUrl, url.pathname)
        : stateFromUrl;
      return applyState(state, storeState, url.pathname, navigation);
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
      ? { [namespaceKey]: [format.stringify(compacted)] }
      : {};
  };

  // The params this store writes for a state in URL shape.
  const ownedKeys = (urlState: object) =>
    new Set(standalone ? Object.keys(toParams(urlState)) : [namespaceKey]);

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
    // A click applies the passed keys to the live state, a new tab to the initial state; neither changes a class instance in place.
    const state = get() as object;
    const clicked = urlStateOf(
      applyState(state, partial, pathname, true),
      pathname,
    );
    const opened = urlStateOf(
      applyState(initialState, partial, pathname, true),
      pathname,
    );
    // The fields of next that differ from prev, a key prev lacks included.
    const changed = (next: object, prev: object) =>
      compact(
        next,
        prev,
        defaultedOptions.syncNull,
        defaultedOptions.syncUndefined,
        Object.keys(next).filter(
          key => !Object.prototype.hasOwnProperty.call(prev, key),
        ),
      ).output;
    // What a click or a new tab changes, written with the click's values: a map packing fields into one param keeps those not passed.
    const output = pickFields(clicked, [
      changed(opened, urlDefaults(pathname)),
      changed(clicked, urlStateOf(state, pathname)),
    ]);
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

    const currentUrl = () => location.pathname + location.search;
    // The URL this store last wrote or read; any other URL is a navigation.
    let lastUrl = currentUrl();
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
      if (currentUrl() === lastUrl) return;
      lastUrl = currentUrl();
      writeOwed = true;
      if (subscribers > 0) armWrite();
      const current = get() as Record<string, unknown>;
      const next = initialize(new URL(location.href), current, true);
      // Only changed keys, so the others keep their references.
      const changed = pickBy(next, (value, key) =>
        Object.prototype.hasOwnProperty.call(current, key)
          ? !isSameState(value, current[key])
          : ownsNewKeys,
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
      const managedKeys = new Set([...currentKeys, ...previouslyManagedKeys]);
      previouslyManagedKeys = currentKeys;
      url.search = rewriteSearch(
        url.search,
        managedKeys,
        toParams(newCompacted),
      );

      if (url.search !== previous) {
        history.replaceState(history.state, '', url);
      }
      lastUrl = currentUrl();
    };

    // @ts-ignore
    if (!api.__ZUSTAND_QUERYSTRING_INIT__) {
      // @ts-ignore
      api.__ZUSTAND_QUERYSTRING_INIT__ = true;
      let frame = 0;
      const cb = () => {
        // Scheduled before the read, so an unsubscribe during the read cancels it.
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
