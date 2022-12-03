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
  key?: string;
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
    partialize: state => state,
    key: '$',
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
    return state;
  };

  const initialize = (url: string, _set = set) => {
    const fallback = () => fn(_set, get, api);
    try {
      const splitUrl = url.split('?');
      const queryString = splitUrl[1];
      const pathname = splitUrl[0];

      if (!queryString) {
        return fallback();
      }

      const idx = queryString.indexOf(defaultedOptions.key + '=');
      if (idx === -1) {
        return fallback();
      }

      const toParse = queryString.substring(idx + 2);

      if (!toParse) {
        return fallback();
      }

      // console.log('toParse', toParse);

      const parsed = parse(toParse);
      const currentValue = get() ?? fn(_set, get, api);
      const merged = mergeWith(
        currentValue,
        getSelectedState(parsed, pathname)
      );
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
      const selectedState = getSelectedState(get(), window.location.pathname);
      if (!selectedState) {
        return;
      }
      const compactedSelectedState = compact(selectedState, initialState);
      const stringified =
        compactedSelectedState && stringify(compactedSelectedState);
      const currentQueryString = window.location.search.slice(1);
      if (stringified || currentQueryString) {
        // console.log('set query', stringified);
        // console.log('parse query', parse(stringified));
        // parse current querystring
        // split query string to key-value
        const variables = {};
        const currentQuery = currentQueryString.split('&');
        for (const variable of currentQuery) {
          if (stringified?.includes(variable)) {
            continue;
          }
          const [key, value] = variable.split('=');
          variables[key] = value;
        }
        variables[defaultedOptions.key] = stringified;
        const newQueryString = Object.keys(variables) // filter out empty values
          .filter(key => variables[key])
          // join key-value pairs
          .map(key => `${key}=${variables[key]}`)
          // join all pairs with &
          .join('&');

        // console.log('newQueryString', newQueryString);

        window.history.replaceState(
          null,
          '',
          newQueryString ? `?${newQueryString}` : window.location.pathname
        );
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
