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
     * A URL for `pathname` with the initial state plus the fields of `state` that `select` syncs there. It leaves out the rest of the current state, though a custom `map` can write current values of fields you didn't pass in a param the link changes.
     * A passed value equal to the initial state is written only when the current value differs.
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

// The fields of source that any of the masks holds, down to where one of them holds a whole value; source itself when that is all of it.
const pickFields = (source: object, masks: object[]): object => {
  const picked = {};
  let all = true;
  for (const key of Object.keys(source)) {
    const fields = masks
      .filter(m => Object.prototype.hasOwnProperty.call(m, key))
      .map(m => m[key] as object);
    if (!fields.length) {
      all = false;
      continue;
    }
    const value =
      isPlainObject(source[key]) &&
      fields.every(f => isPlainObject(f) && !isEmpty(f))
        ? pickFields(source[key], fields)
        : source[key];
    if (value !== source[key]) all = false;
    setOwn(picked, key, value);
  }
  return all ? source : picked;
};

// The fields of next that prev lacks or holds another value for: with deep, down to the fields of a plain object.
// Two objects that aren't the same one are another value unless sameObject says they are alike.
const changedFields = (
  next: object,
  prev: object,
  deep: boolean,
  sameObject: (path: string[], value: object, before: object) => boolean,
  path: string[] = [],
) => {
  const changed = {};
  for (const key of Object.keys(next)) {
    const value = next[key];
    const before = prev[key];
    const has =
      before !== undefined || Object.prototype.hasOwnProperty.call(prev, key);
    if (has && Object.is(value, before)) continue;
    if (
      deep &&
      isPlainObject(value) &&
      !isEmpty(value) &&
      isObjectLike(before) &&
      !Array.isArray(before)
    ) {
      const fields = changedFields(value, before, deep, sameObject, [
        ...path,
        key,
      ]);
      if (!isEmpty(fields)) setOwn(changed, key, fields);
    } else if (
      !(
        isObjectLike(value) &&
        isObjectLike(before) &&
        sameObject([...path, key], value, before)
      )
    ) {
      setOwn(changed, key, value);
    }
  }
  return changed;
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

// The value at a path of own keys, or undefined where the path leaves the objects.
const getIn = (state: unknown, path: string[]) =>
  path.reduce<unknown>(
    (value, key) =>
      isObjectLike(value)
        ? getOwn(value as Record<string, unknown>, key)
        : undefined,
    state,
  );

// A copy of state with value at a path of own keys, copying the objects along it.
const setIn = (
  state: Record<string, any>,
  [key, ...rest]: string[],
  value: unknown,
): object => {
  const copy = { ...state };
  setOwn(
    copy,
    key,
    rest.length ? setIn(getOwn(state, key), rest, value) : value,
  );
  return copy;
};

// Deletes the field at a path of own keys, and each object that leaves empty.
const deleteIn = (state: Record<string, any>, [key, ...rest]: string[]) => {
  const inner = getOwn(state, key);
  if (rest.length) deleteIn(inner, rest);
  if (!rest.length || isEmpty(inner)) delete state[key];
};

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

type Instances = 'merge' | 'keep' | 'read';

type MergeOptions = {
  instances: Instances;
  inPlace?: Set<string>;
  delta?: boolean;
  syncUndefined?: boolean;
};

// URL state replaces what it carries; a plain object merges key by key. The selection is the one of the URL's pathname, or true where all of it is selected.
// A class instance is merged into itself at creation ('merge'), left as it is by a navigation unless it is the state ('keep'),
// and read as a plain object of its own fields for a link ('read'). inPlace collects the top-level keys under which a class instance was written into.
// With delta, the result holds only the fields urlState carries, as the state would hold them.
const mergeUrlState = (
  state: object,
  urlState: object,
  selection: Record<string, any> | true,
  { instances, inPlace, delta = false, syncUndefined = false }: MergeOptions,
) => {
  // Each URL object merged so far and its result, so a cycle in the URL state becomes the same cycle.
  const merges = new Map<object, object>();
  // keys is listed once per object: listing the keys of a large object walks all of them.
  const merge = (
    state: object,
    urlState: object,
    selection: Record<string, any> | true,
    keys: string[],
    top?: string,
  ) => {
    const copied = isPlainObject(state) || instances === 'read';
    const merged: Record<string, any> = delta
      ? {}
      : copied
        ? { ...state }
        : state;
    const write = (key: string, value: unknown) => {
      if (!copied) inPlace?.add(top ?? key);
      setOwn(merged, key, value);
    };
    merges.set(urlState, merged);
    for (const key of keys) {
      // A __proto__ key would set the prototype of the copy zustand's setState makes.
      if (key === '__proto__') continue;
      const value = urlState[key];
      if (value === undefined && !syncUndefined) continue;
      const current = getOwn(
        (delta ? state : merged) as Record<string, any>,
        key,
      );
      const selected = selection === true ? true : getOwn(selection, key);
      const valueKeys = isPlainObject(value) ? Object.keys(value) : undefined;
      const isEmptyObject = valueKeys?.length === 0;
      // An empty object over an object whose fields select syncs only some of clears just those.
      if (isEmptyObject && isPlainObject(current) && isPlainObject(selected)) {
        write(key, clearSelected(current, selected));
        continue;
      }
      // A URL never replaces a function, like an action, nor an object holding one at any depth with anything but a non-empty plain object.
      if (
        typeof current === 'function' ||
        ((valueKeys === undefined || isEmptyObject) && holdsFunction(current))
      )
        continue;
      if (valueKeys === undefined) {
        write(key, value);
        continue;
      }
      if (merges.has(value)) {
        write(key, merges.get(value));
        continue;
      }
      // A plain object merges into the object it lands on, or into a new one, so no two stores share the URL's object.
      const into =
        isObjectLike(current) &&
        !Array.isArray(current) &&
        !(isEmptyObject && isPlainObject(current))
          ? current
          : {};
      if (instances === 'keep' && !isPlainObject(into)) continue;
      const fields = merge(
        into,
        value,
        isPlainObject(selected) ? selected : true,
        valueKeys,
        top ?? key,
      );
      // An object none of whose fields is applied carries nothing, unless it is empty.
      if (delta && isEmpty(fields) && !isEmptyObject) continue;
      write(key, fields);
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

  // The URL state the format reads from this store's params, with the defaults as type hints; null when there are none or the one param can't be read.
  const fromParams = (params: QueryStringParams, initialState: object) => {
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

  // The initial state in URL shape: the parse hints, and what the store leaves out of the URL it writes.
  const urlDefaults = (pathname: string): object =>
    urlStateOf(initialState, pathname);

  // The state with a store-shaped state applied, as a navigation or the store's creation applies a URL.
  const applyState = (
    state,
    storeState,
    pathname: string,
    options: MergeOptions,
  ) =>
    mergeUrlState(
      state,
      getSelectedState(storeState, pathname, 'partial'),
      defaultedOptions.select
        ? (defaultedOptions.select(pathname) as object)
        : true,
      { syncUndefined: defaultedOptions.syncUndefined, ...options },
    );

  // The URL keys under which a URL was written into a class instance, at creation or into the state by a navigation: their value from before is gone, so they never count as unchanged.
  let urlSetKeys: string[] = [];

  const initialize = (url: URL, state, instances: 'merge' | 'keep') => {
    try {
      const stateFromUrl = fromParams(
        parseSearchString(url.search),
        urlDefaults(url.pathname),
      );
      if (!stateFromUrl) {
        return state;
      }
      // stateFromUrl is in URL shape — map.from converts it back to store shape
      const storeState = map
        ? map.from(stateFromUrl, url.pathname)
        : stateFromUrl;
      const inPlace = new Set<string>();
      const merged = applyState(state, storeState, url.pathname, {
        instances,
        inPlace,
      });
      // With a map the URL keys behind an instance aren't known, so all the URL's keys count.
      if (inPlace.size > 0) {
        urlSetKeys = Array.from(
          new Set([
            ...urlSetKeys,
            ...(map ? Object.keys(stateFromUrl) : Array.from(inPlace)),
          ]),
        );
      }
      return merged;
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

  // What the store starts with on a URL that carries none of its params, except inside a class instance a URL wrote into (urlSetKeys).
  let startState: ReturnType<typeof fn>;

  // A setDefaults call inside the initializer applies to the state it returns.
  const createState = (setState: typeof set) => {
    const state = fn(setState, get, api);
    startState = state;
    initialState = initialState ? withDefaults(state, initialState) : state;
    return state;
  };

  // The search of a link to a URL state: the fields the sync policy writes, encoded like the store's own write, so a # in a value stays in the query.
  const writeLinkUrl = (urlState: object): string => {
    const { output } = compact(
      urlState,
      {},
      defaultedOptions.syncNull,
      defaultedOptions.syncUndefined,
      Object.keys(urlState),
    );
    const url = new URL('http://localhost');
    url.search = rewriteSearch('', new Set(), toParams(output));
    return url.search;
  };

  // @ts-ignore - typed via StoreMutators augmentation
  api.href = (pathname: string, passed: object = {}) => {
    // Inside the initializer there is no state yet, so a link starts from none.
    const live = (get() ?? {}) as object;
    const start = startState ?? live;
    // Without a map the store reads a plain object field by field, so only the passed fields can reach the link; a map reads a URL key whole.
    const byField = !map;
    // The state after a store at base follows the link; a class instance reads as its own fields, so none is written into.
    // A map gets a passed undefined, which it may write as a value; the URL it returns follows syncUndefined.
    const follow = (base: object, delta = byField) =>
      applyState(base, passed, pathname, {
        instances: 'read',
        delta,
        syncUndefined: !byField || defaultedOptions.syncUndefined,
      });
    // The URL written for each URL state this link compares or writes.
    const written = new Map<object, string>();
    const writtenOf = (urlState: object) => {
      let url = written.get(urlState);
      if (!url) written.set(urlState, (url = writeLinkUrl(urlState)));
      return url;
    };
    // user decision 2026-11-25: a passed default is written only when the live value differs (keeps links short; a click still clears)
    // What a store at base sees change in its URL state when following the link takes it to followed, whose URL state is next.
    const changes = (base: object, followed: object, next: () => object) => {
      // A state whose fields all stay alike projects alike, so it changes nothing.
      if (
        Object.keys(followed).every(
          key =>
            Object.prototype.hasOwnProperty.call(base, key) &&
            isSameState(followed[key], base[key]),
        )
      )
        return {};
      const known = urlStateOf(base, pathname);
      const urlState = next();
      // The paths where the two differ and hold distinct class instances.
      const swaps: string[][] = [];
      const sameObject = (path: string[], value: object, before: object) => {
        let instances = false;
        const equal = isEqualWith(value, before, (a, b) => {
          if (!isInstance(a) && !isInstance(b)) return undefined;
          if (a !== b) instances = true;
          return a === b;
        });
        if (!equal && instances) swaps.push(path);
        return equal;
      };
      const changed = changedFields(urlState, known, byField, sameObject);
      if (!swaps.length) return changed;
      // A class instance can hide its data, so it is alike when the follower written whole with the base's value in its place writes the same search.
      const whole = byField
        ? urlStateOf(follow(base, false), pathname)
        : urlState;
      const search = writtenOf(whole);
      const writesAlike = (paths: string[][]) => {
        try {
          const swapped = paths.reduce(
            (state, path) => setIn(state, path, getIn(known, path)),
            whole,
          );
          return writeLinkUrl(swapped) === search;
        } catch {
          return false;
        }
      };
      const alike =
        swaps.length > 1 && writesAlike(swaps)
          ? swaps
          : swaps.filter(path => writesAlike([path]));
      for (const path of alike) deleteIn(changed, path);
      return changed;
    };
    const clicked = follow(live);
    let values: object | undefined;
    // The click's URL state, which a new tab shares when it follows the link to the same state.
    const clickedUrlState = () => (values ??= urlStateOf(clicked, pathname));
    const changed = [changes(live, clicked, clickedUrlState)];
    if (start !== live) {
      const followed = follow(start);
      // Following to the click's state, a new tab compares the click's URL state.
      changed.push(
        !byField && isSameState(followed, clicked)
          ? changes(start, clicked, clickedUrlState)
          : changes(start, followed, () => urlStateOf(followed, pathname)),
      );
    }
    // A key a URL set inside a class instance is written whenever it is passed.
    if (byField)
      changed.push(pickBy(passed, (_value, key) => urlSetKeys.includes(key)));
    // Written with the click's values: a map packing fields into one param keeps those not passed.
    const link = changed.every(isEmpty)
      ? {}
      : pickFields(clickedUrlState(), changed);
    return pathname + writtenOf(link);
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
      const next = initialize(new URL(location.href), current, 'keep');
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
        urlSetKeys,
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
    const initialized = initialize(
      new URL(window.location.href),
      state,
      'merge',
    );
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
      'merge',
    );
    api.getInitialState = () => initialized;
    return initialized;
  }

  return createState(set);
};

export const querystring = queryStringImpl as unknown as QueryString;
