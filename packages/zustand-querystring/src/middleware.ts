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
     * A URL for `pathname` with the initial state plus the fields of `state` that `select` syncs there. It leaves out the rest of the current state, though a custom `map` can make current values of fields you didn't pass part of the link, in a param value it packs, a param name it derives, or other params the reader needs to decode a value you passed: `href` reads the link as a store would and looks for the params the reader needs in the current state (see the README for its limits).
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

// A value whose class can hold state that deep equality doesn't see: an instance of a user class, or of a subclass of a built-in one.
const isOpaque = (value: unknown) => {
  if (!isObjectLike(value)) return false;
  let depth = 0;
  for (let p = Object.getPrototypeOf(value); p; p = Object.getPrototypeOf(p))
    depth++;
  // A built-in's own instances have this many prototypes, in any realm.
  const builtIn = isTypedArray(value)
    ? 3
    : Array.isArray(value) ||
        isDate(value) ||
        isRegExp(value) ||
        isMap(value) ||
        isSet(value)
      ? 2
      : 1;
  return depth > builtIn;
};

// Deep equality of data. For two distinct values of which one is opaque, opaque() decides, or their visible data when it returns undefined.
const sameData = (a: unknown, b: unknown, opaque: () => boolean | undefined) =>
  isEqualWith(a, b, (x, y) =>
    x !== y && (isOpaque(x) || isOpaque(y)) ? opaque() : undefined,
  );

// The items that can be swapped together without a change, as same tells: all of them, or each that still can after the ones before it.
const unseen = <T>(items: T[], same: (swapped: T[]) => boolean): T[] => {
  if (items.length > 1 && same(items)) return items;
  const kept: T[] = [];
  for (const item of items) if (same([...kept, item])) kept.push(item);
  return kept;
};

// Tells which of the paths hold the same value, as the store's writer does.
type Alike = (paths: string[][]) => string[][];

// Whether two values are the same data. Two distinct values of which one is opaque are told apart by the store's writer: their path is noted in met and they count as another value until it tells.
// With visible, the writer is asked only where their visible data are alike; without met, their visible data decide.
const sameField = (
  value: unknown,
  before: unknown,
  path: string[],
  met: string[][] | undefined,
  visible: boolean,
) => {
  let opaque = false;
  const same = sameData(value, before, () => {
    opaque = true;
    return visible ? undefined : true;
  });
  if (same && opaque && met) met.push(path);
  return same && !(opaque && met);
};

// Leaves out of changed the paths, of those noted in met, that alike tells hold the same value.
const withoutAlike = (changed: object, met: string[][], alike?: Alike) => {
  if (alike && met.length)
    for (const path of alike(met)) deleteIn(changed, path);
  return changed;
};

// What the address bar writes of a state: the fields that differ from the initial state's, as the sync policy writes them.
export const compact = (
  newState: object,
  initialState: object,
  syncNull = false,
  syncUndefined = false,
  // Keys kept even at their initial value; nothing inside them is compared.
  forced: string[] = [],
  alike?: Alike,
) => {
  const met: string[][] = [];
  // Each object of newState being walked and the one it is compared with, so a cycle ends where it closes.
  const active = new Map<object, object>();
  const walk = (
    newState: object,
    initialState: object,
    forced: string[],
    path: string[],
  ) => {
    const output = {};
    Object.keys(newState).forEach(key => {
      const newValue = newState[key];
      const initialValue = initialState[key];
      const isForced = forced.includes(key);
      const noted = met.length;

      if (
        typeof newValue !== 'function' &&
        (isForced ||
          !sameField(
            newValue,
            initialValue,
            [...path, key],
            alike && met,
            true,
          )) &&
        (syncNull || newValue !== null) &&
        (syncUndefined || newValue !== undefined)
      ) {
        const isPlain =
          typeof newValue === 'object' &&
          newValue !== null &&
          !Array.isArray(newValue) &&
          newValue.constructor === Object;

        if (isPlain && isForced) {
          if (active.has(newValue)) {
            output[key] = newValue;
            return;
          }
          active.set(newValue, {});
          const fields = walk(newValue, {}, Object.keys(newValue), [
            ...path,
            key,
          ]);
          active.delete(newValue);
          // An object none of whose fields is written is left out too, unless it is empty.
          if (!isEmpty(fields) || isEmpty(newValue)) {
            output[key] = fields;
          }
        } else if (
          isPlain &&
          initialValue &&
          typeof initialValue === 'object'
        ) {
          // Its fields note their own paths, so met holds no path inside another.
          met.length = noted;
          if (active.has(newValue)) {
            // The same pair is compared further out; another pair is written whole.
            if (active.get(newValue) !== initialValue) output[key] = newValue;
            return;
          }
          active.set(newValue, initialValue);
          const fields = walk(newValue, initialValue, [], [...path, key]);
          active.delete(newValue);
          // An empty object over a non-empty default is kept, so a cleared filter stays cleared.
          if (!isEmpty(fields) || isEmpty(newValue)) {
            output[key] = fields;
          }
        } else {
          output[key] = newValue;
        }
      }
    });
    return output;
  };
  return {
    output: withoutAlike(walk(newState, initialState, forced, []), met, alike),
  };
};

// The fields of next that prev lacks or holds another value for: with deep, down to the fields of a plain object.
const diff = (next: object, prev: object, deep: boolean, alike: Alike) => {
  const met: string[][] = [];
  const walk = (next: object, prev: object, path: string[]) => {
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
        const fields = walk(value, before, [...path, key]);
        if (!isEmpty(fields)) setOwn(changed, key, fields);
      } else if (
        !has ||
        !sameField(value, before, [...path, key], met, false)
      ) {
        setOwn(changed, key, value);
      }
    }
    return changed;
  };
  return withoutAlike(walk(next, prev, []), met, alike);
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
  // Each URL object being merged and its result, so a cycle in the URL state becomes the same cycle; an object met again in another place is merged there too.
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
    merges.delete(urlState);
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
  // (QueryStringOptions<T, K>) ensures type safety at the call site.
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

  // The URL state the format reads from this store's params in a search, with the pathname's defaults as type hints; null when there are none or the one param can't be read.
  const readUrlState = (search: string, pathname: string) => {
    const params = parseSearchString(search);
    const initialState = urlDefaults(pathname);
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
      const stateFromUrl = readUrlState(url.search, url.pathname);
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

  // Tells the paths, of those where whole and prev hold two distinct values of which one is opaque, at which prev's value writes the same search.
  const alikeIn =
    (whole: () => object, prev: object, write = writeLinkUrl): Alike =>
    paths => {
      let search: string | undefined;
      return unseen(paths, swapped => {
        try {
          return (
            write(
              swapped.reduce(
                (state, path) => setIn(state, path, getIn(prev, path)),
                whole(),
              ),
            ) === (search ??= write(whole()))
          );
        } catch {
          return false;
        }
      });
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
    // The search written for each URL state this link compares or writes.
    const searches = new Map<object, string>();
    const written = (urlState: object) => {
      let search = searches.get(urlState);
      if (search === undefined)
        searches.set(urlState, (search = writeLinkUrl(urlState)));
      return search;
    };
    // user decision 2026-11-25: a passed default is written only when the live value differs (keeps links short; a click still clears)
    // user decision 2026-11-27: the link rules stay exact through a map that returns class instances, at the cost of extra writes per link
    // What a store at base sees change in its URL state when following the link takes it to followed, whose URL state is next.
    const changes = (base: object, followed: object, next: () => object) => {
      // A state whose fields all stay alike projects alike, so it changes nothing.
      if (
        Object.keys(followed).every(
          key =>
            Object.prototype.hasOwnProperty.call(base, key) &&
            sameData(followed[key], base[key], () => false),
        )
      )
        return {};
      const known = urlStateOf(base, pathname);
      const urlState = next();
      // An opaque value is compared in the follower's whole URL state.
      let whole: object | undefined;
      return diff(
        urlState,
        known,
        byField,
        alikeIn(
          () =>
            (whole ??= byField
              ? urlStateOf(follow(base, false), pathname)
              : urlState),
          known,
          written,
        ),
      );
    };
    const clicked = follow(live);
    let values: object | undefined;
    // The click's URL state, which a new tab shares when it follows the link to the same state.
    const clickedUrlState = () => (values ??= urlStateOf(clicked, pathname));
    // The link with the click's other keys it needs: a map's reader may need another param to read it, or read it as more than it says, so it is read as a store reads it.
    const withCompanions = (link: object): object => {
      // Two store states alike: deep-equal data, and for two distinct values of which one is opaque, the same search written.
      const sameState = (a: object, b: object) => {
        let opaque = false;
        return (
          sameData(a, b, () => (opaque = true)) &&
          (!opaque ||
            writeLinkUrl(urlStateOf(a, pathname)) ===
              writeLinkUrl(urlStateOf(b, pathname)))
        );
      };
      type Check = {
        rejected: boolean;
        live: boolean;
        exact: number;
        passed: number;
      };
      const unread: Check = {
        rejected: true,
        live: false,
        exact: 0,
        passed: 0,
      };
      // How stores read a search: rejected by the format or map.from; live when the clicking store lands where it follows to; exact, the followers that do; passed, those too that land where the link changes nothing more.
      const read = (search: string): Check => {
        try {
          const urlState = readUrlState(search, pathname);
          // A namespaced reader that rejects its one param reads as none.
          if (!urlState && !standalone && search) return unread;
          const storeState = urlState ? map!.from(urlState, pathname) : {};
          const result = { rejected: false, live: false, exact: 0, passed: 0 };
          // The clicking store follows as a navigation applies a URL, on a copy; a new tab as its creation does, without writing into an instance.
          followers.forEach(([base, target], i) => {
            const landed = i
              ? applyState(base, storeState, pathname, { instances: 'read' })
              : applyState({ ...base }, storeState, pathname, {
                  instances: 'keep',
                });
            const isExact = sameState(landed, target);
            if (i === 0) result.live = isExact;
            if (isExact) result.exact++;
            if (isExact || (i > 0 && sameState(follow(landed), landed)))
              result.passed++;
          });
          return result;
        } catch {
          return unread;
        }
      };
      // How stores read a URL state's link, read once per search.
      const checks = new Map<string, Check>();
      const check = (urlState: object): Check => {
        try {
          const search = written(urlState);
          let result = checks.get(search);
          if (!result) checks.set(search, (result = read(search)));
          return result;
        } catch {
          return unread;
        }
      };
      const complete = (c: Check) => c.live && c.passed === followers.length;
      if (complete(check(link))) return link;
      // Read first, then the store that clicks landing where it follows to, then the followers that pass, then those that land exactly.
      const rank = (c: Check) =>
        [!c.rejected, c.live, c.passed, c.exact].map(Number);
      const better = (a: Check, b: Check) => {
        const [x, y] = [rank(a), rank(b)];
        const i = x.findIndex((value, i) => value !== y[i]);
        return i >= 0 && x[i] > y[i];
      };
      // A map may read a value through another param: the link then also takes some of the click's other keys.
      const full = clickedUrlState();
      const has = (urlState: object, key: string) =>
        Object.prototype.hasOwnProperty.call(urlState, key);
      const others = Object.keys(full).filter(key => !has(link, key));
      const plus = (keys: string[]) =>
        pickBy(full, (_value, key) => has(link, key) || keys.includes(key));
      // Keys of the pool that with the link land better than a link that checks as than does: all of them or, when a pool of 3 to 8 lands no better whole, the best of them without one, narrowed by halves; none when neither lands better.
      const findCompanions = (pool: string[], than: Check): string[] => {
        if (!pool.length) return [];
        let keys = pool;
        let goal = check(plus(pool));
        if (!better(goal, than)) {
          if (pool.length <= 2 || pool.length > 8) return [];
          let found: string[] | undefined;
          for (let i = 0; i < pool.length && !(found && complete(goal)); i++) {
            const without = pool.filter((_, j) => j !== i);
            const result = check(plus(without));
            if (better(result, found ? goal : than)) {
              found = without;
              goal = result;
            }
          }
          if (!found) return [];
          keys = found;
        }
        // By halves (QuickXplain): the candidates that with keep land as well as goal, where more keys never land a link worse.
        const shrink = (keep: string[], candidates: string[]): string[] => {
          if (keep.length && !better(goal, check(plus(keep)))) return [];
          if (candidates.length === 1) return candidates;
          const mid = candidates.length >> 1;
          const left = candidates.slice(0, mid);
          const needRight = shrink([...keep, ...left], candidates.slice(mid));
          const needLeft = shrink([...keep, ...needRight], left);
          return [...needLeft, ...needRight];
        };
        return shrink([], keys);
      };
      // The click's other keys a new tab doesn't start with: the current view.
      const viewOf = (startUrl: object) =>
        Object.keys(
          diff(
            full,
            startUrl,
            false,
            alikeIn(() => full, startUrl, written),
          ),
        ).filter(key => !has(link, key));
      const view = start === live ? [] : viewOf(urlStateOf(start, pathname));
      // The view's keys first; a link the reader reads may take any of the click's other keys, a rejected one never a key every follower already has.
      const pools = check(link).rejected ? [view] : [view, others];
      // Up to 8 keys of each pool are each tried alone first, which costs about the reads halving does: one key that lands the link is found, whatever the reader makes of combinations.
      for (const pool of pools)
        if (pool.length <= 8) {
          const one = pool.find(key => complete(check(plus([key]))));
          if (one !== undefined) return plus([one]);
        }
      let best = link;
      for (const pool of pools) {
        if (complete(check(best))) break;
        const candidate = plus(findCompanions(pool, check(best)));
        if (better(check(candidate), check(best))) best = candidate;
      }
      return best;
    };

    // Each store that can follow the link, and the state it follows to.
    const followers = [[live, clicked]];
    if (start !== live) followers.push([start, follow(start)]);
    // What each of them sees change; following to the click's state, a new tab compares the click's URL state.
    const changed = followers.map(([base, followed]) =>
      followed === clicked ||
      (!byField && sameData(followed, clicked, () => false))
        ? changes(base, clicked, clickedUrlState)
        : changes(base, followed, () => urlStateOf(followed, pathname)),
    );
    // A key a URL set inside a class instance is written whenever it is passed.
    if (byField)
      changed.push(pickBy(passed, (_value, key) => urlSetKeys.includes(key)));
    // Written with the click's values: a map packing fields into one param keeps those not passed.
    const link = changed.every(isEmpty)
      ? {}
      : pickFields(clickedUrlState(), changed);
    // pickFields returns the click's URL state itself when the link holds all of it: such a link is not read again.
    if (byField || isEmpty(link) || link === clickedUrlState())
      return pathname + written(link);
    return pathname + written(withCompanions(link));
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
      // Only changed keys, so the others keep their references; an opaque value whose visible data stay alike is kept when the store writes the same URL with it.
      const met: string[][] = [];
      const pathname = location.pathname;
      const changed = pickBy(next, (value, key) =>
        Object.prototype.hasOwnProperty.call(current, key)
          ? !sameField(value, current[key], [key], met, true)
          : ownsNewKeys,
      );
      // A key the URL state is the same without, like one map.from derives, can't be compared by the URL: it is set. A writer that throws without the key writes it.
      const reachesUrl = ([key]: string[]) => {
        try {
          return !sameData(
            urlStateOf(
              pickBy(next, (_value, name) => name !== key),
              pathname,
            ),
            urlStateOf(next, pathname),
            () => undefined,
          );
        } catch {
          return true;
        }
      };
      withoutAlike(
        changed,
        met.filter(reachesUrl),
        alikeIn(
          () => next,
          current,
          state => writeLinkUrl(urlStateOf(state, pathname)),
        ),
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
      const defaults = urlDefaults(url.pathname);
      const { output: newCompacted } = compact(
        stateForUrl,
        defaults,
        defaultedOptions.syncNull,
        defaultedOptions.syncUndefined,
        urlSetKeys,
        alikeIn(() => stateForUrl, defaults),
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
