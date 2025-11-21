import { isEqual, mergeWith } from 'lodash-es';
import { StateCreator, StoreMutatorIdentifier } from 'zustand/vanilla';
import { parse, stringify } from './parser.js';

type DeepSelect<T> = T extends object
  ? {
      [P in keyof T]?: DeepSelect<T[P]> | boolean;
    }
  : boolean;

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

export interface QueryStringOptions<T> {
  url?: string;
  select?: (pathname: string) => DeepSelect<T>;
  key?: string;
  format?: {
    stringify: (value: DeepPartial<T>) => string;
    parse: (value: string) => DeepPartial<T>;
  };
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
    format: {
      stringify,
      parse,
    },
    ...options,
  };

  const getStateFromUrl = (url: URL) => {
    const params = url.search.slice(1).split('&');
    for (const param of params) {
      const eqIndex = param.indexOf('=');
      if (eqIndex === -1) continue;
      const key = param.slice(0, eqIndex);
      if (key === defaultedOptions.key) {
        const value = param.slice(eqIndex + 1);
        return value ? defaultedOptions.format.parse(value) : null;
      }
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
        {},
        initialState,
        getSelectedState(stateFromURl, url.pathname),
      );

      return merged;
    } catch (error) {
      console.error(error);
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
      const newCompacted = compact(selectedState, initialState);
      const previous = url.search;
      
      // Parse existing query params, preserving order
      const params = url.search.slice(1).split('&').filter(Boolean);
      let stateIndex = -1;
      
      // Remove our param, remember its position
      const otherParams = params.filter((p, i) => {
        const [key] = p.split('=', 1);
        if (key === defaultedOptions.key) {
          stateIndex = i;
          return false;
        }
        return true;
      });
      
      // Add our param back if we have state
      if (Object.keys(newCompacted).length) {
        const value = defaultedOptions.format.stringify(newCompacted);
        const position = stateIndex === -1 ? otherParams.length : stateIndex;
        otherParams.splice(position, 0, `${defaultedOptions.key}=${value}`);
      }
      
      url.search = otherParams.length ? '?' + otherParams.join('&') : '';
      
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
