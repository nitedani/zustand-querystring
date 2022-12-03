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

  if (Object.keys(output).length === 0) {
    return null;
  }

  return output;
};

const translateSelectionToState = <T>(selection: DeepSelect<T>, state: T) =>
  Object.keys(selection).reduce((acc, key) => {
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
    partialize: state => state,
    ...options,
  };
  const url = defaultedOptions.url;

  const initialState = get() ?? fn(set, get, api);

  const getSelectedState = () => {
    if (defaultedOptions.select) {
      const selection = defaultedOptions.select(window.location.pathname);
      // translate the selection to state
      const selectedState = translateSelectionToState(selection, get());
      return selectedState;
    }
    return get();
  };

  const initialize = (url: string, _set = set) => {
    try {
      const queryString = url.split('?')[1]?.slice(2);
      if (!queryString) {
        return fn(_set, get, api);
      }
      const parsed = parse(queryString);
      const currentValue = get() ?? fn(_set, get, api);
      const merged = mergeWith(currentValue, parsed);
      set(merged, true);
      return merged;
    } catch (error) {
      console.error(error);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }

      return fn(_set, get, api);
    }
  };

  if (typeof window !== 'undefined') {
    const setQuery = () => {
      const selectedState = getSelectedState();
      if (!selectedState) {
        return;
      }

      const compactedSelectedState = compact(selectedState, initialState);

      if (!compactedSelectedState) {
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      const stringified = stringify(compactedSelectedState);

      if (stringified) {
        // console.log('set query', stringified);
        // console.log('parse query', parse(stringified));
        window.history.replaceState(null, '', `?q=${stringified}`);
      }
    };

    //TODO: find a better way to do this
    let previousUrl = '';
    setInterval(() => {
      if (window.location.href !== previousUrl) {
        previousUrl = window.location.href;
        setQuery();
      }
    }, 50);

    const originalSetState = api.setState;
    api.setState = (...args) => {
      originalSetState(...args);
      setQuery();
    };

    return initialize(window.location.href, (...args) => {
      set(...args);
      setQuery();
    });
  }

  if (url) {
    return initialize(url);
  }

  return fn(set, get, api);
};

export const queryString = queryStringImpl as unknown as QueryString;
