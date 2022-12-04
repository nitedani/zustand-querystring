import { parse, stringify } from './parser.js';
import { mergeWith, isEqual } from 'lodash-es';
import { StateCreator, StoreMutatorIdentifier } from 'zustand/vanilla';

type DeepSelect<T> = T extends object
  ? {
      [P in keyof T]?: DeepSelect<T[P]> | boolean;
    }
  : boolean;

export interface QueryStringOptions<T> {
  url?: string;
  select?: (pathname: string) => DeepSelect<T>;
}

type QueryString = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  initializer: StateCreator<T, Mps, Mcs>,
  options?: QueryStringOptions<T>
) => StateCreator<T, Mps, Mcs>;

type QueryStringImpl = <T>(
  storeInitializer: StateCreator<T, [], []>,
  options?: QueryStringOptions<T>
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

const translateSelectionToState = <T>(selection: DeepSelect<T>, state: T) =>
  Object.keys(selection).reduce((acc, key) => {
    // @ts-ignore
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

const queryStringImpl: QueryStringImpl = (fn, options?) => (set, get, api) => {
  const defaultedOptions = {
    ...options,
  };
  const url = defaultedOptions.url;

  const initialState = get() ?? fn(set, get, api);

  const getSelectedState = (state, pathname) => {
    if (defaultedOptions.select) {
      const selection = defaultedOptions.select(pathname);
      // translate the selection to state
      const selectedState = translateSelectionToState(selection, state);
      return selectedState;
    }
    return state ?? {};
  };

  const initialize = (url: string, _set = set) => {
    const fallback = () => fn(_set, get, api);
    try {
      const splitUrl = url.split('?');
      let queryString = splitUrl[1];
      const pathname = splitUrl[0];
      if (!queryString) {
        return fallback();
      }

      if (!queryString) {
        return fallback();
      }
      if (!queryString.startsWith('$')) {
        queryString = '$' + queryString;
      }

      const parsed = parse(queryString);
      const currentValue = get() ?? fn(_set, get, api);
      const merged = mergeWith(
        currentValue,
        getSelectedState(parsed, pathname)
      );
      set(merged, true);
      return merged;
    } catch (error) {
      console.error(error);
      return fn(_set, get, api);
    }
  };

  if (typeof window !== 'undefined') {
    const setQuery = () => {
      const selectedState = getSelectedState(get(), window.location.pathname);

      if (!selectedState || Object.keys(selectedState).length === 0) {
        return;
      }

      let currentQueryString = window.location.search.slice(1);
      if (!currentQueryString.startsWith('$')) {
        currentQueryString = '$' + currentQueryString;
      }

      const currentParsed = parse(currentQueryString);
      const newMerged = mergeWith(
        currentParsed,
        selectedState,
        (objValue, srcValue) => {
          if (Array.isArray(objValue)) {
            return srcValue;
          }
        }
      );

      const newCompacted = compact(newMerged, initialState);
      if (Object.keys(newCompacted).length) {
        const stringified = stringify(newCompacted).substring(1);
        window.history.replaceState(null, '', `?${stringified}`);
      } else {
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    //TODO: find a better way to do this
    let previousPathname = '';
    setInterval(() => {
      if (window.location.pathname !== previousPathname) {
        previousPathname = window.location.pathname;
        setQuery();
      }
    }, 50);

    const originalSetState = api.setState;
    api.setState = (...args) => {
      originalSetState(...args);
      setQuery();
    };

    return initialize(
      window.location.pathname + window.location.search,
      (...args) => {
        set(...args);
        setQuery();
      }
    );
  }

  if (url) {
    return initialize(url);
  }

  return fn(set, get, api);
};

export const querystring = queryStringImpl as unknown as QueryString;
