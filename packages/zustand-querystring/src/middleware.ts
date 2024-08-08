import { cloneDeep, isEqual, mergeWith } from 'lodash-es';
import { StateCreator, StoreMutatorIdentifier } from 'zustand/vanilla';
import { parse, stringify } from './parser.js';

type DeepSelect<T> = T extends object
  ? {
      [P in keyof T]?: DeepSelect<T[P]> | boolean;
    }
  : boolean;

export interface QueryStringOptions<T> {
  url?: string;
  select?: (pathname: string) => DeepSelect<T>;
  key?: string;
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

const compact = (newState, initialState) => {
  const output = {};
  Object.keys(newState).forEach(key => {
    if (
      newState[key] !== null &&
      newState[key] !== undefined &&
      typeof newState[key] !== 'function' &&
      !isEqual(newState[key], initialState[key])
    ) {
      if (typeof newState[key] === 'object' && !Array.isArray(newState[key])) {
        const value = compact(newState[key], initialState[key]);
        if (value && Object.keys(value).length > 0) {
          output[key] = value;
        }
      } else {
        output[key] = newState[key];
      }
    }
  });

  return output;
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
    key: 'state',
    ...options,
  };
  const { url } = defaultedOptions;

  const getStateFromUrl = (url: URL) => {
    const match = url.searchParams.get(defaultedOptions.key);
    if (match) {
      return parse(match);
    }
    return null;
  };

  const getSelectedState = (state, pathname) => {
    if (defaultedOptions.select) {
      const selection = defaultedOptions.select(pathname);
      // translate the selection to state
      const selectedState = translateSelectionToState(selection, state);
      return selectedState;
    }
    return state ?? {};
  };

  const initialize = (url: URL, initialState) => {
    try {
      const stateFromURl = getStateFromUrl(url);
      if (!stateFromURl) {
        return initialState;
      }
      const merged = mergeWith(
        cloneDeep(initialState),
        getSelectedState(stateFromURl, url.pathname),
      );
      set(merged, true);
      return merged;
    } catch (error) {
      console.error(error);
      return initialState;
    }
  };

  if (typeof window !== 'undefined') {
    const initialState = cloneDeep(
      fn(
        (...args) => {
          set(...args);
          setQuery();
        },
        get,
        api,
      ),
    );

    const setQuery = () => {
      const url = new URL(window.location.href);
      const selectedState = getSelectedState(get(), url.pathname);
      const newCompacted = compact(selectedState, initialState);
      const previous = url.search;
      if (Object.keys(newCompacted).length) {
        url.searchParams.set(defaultedOptions.key, stringify(newCompacted));
      } else {
        url.searchParams.delete(defaultedOptions.key);
      }
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
      originalSetState(...args);
      setQuery();
    };

    return initialize(new URL(window.location.href), initialState);
  } else if (url) {
    return initialize(new URL(url, 'http://localhost'), fn(set, get, api));
  }

  return fn(set, get, api);
};

export const querystring = queryStringImpl as unknown as QueryString;
