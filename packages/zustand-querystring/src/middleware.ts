import { parse, stringify } from './parser.js';
import { mergeWith, isEqual, cloneDeep } from 'lodash-es';
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

const escapeStringRegexp = string => {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string');
  }

  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
};

const queryStringImpl: QueryStringImpl = (fn, options?) => (set, get, api) => {
  const defaultedOptions = {
    key: '$',
    ...options,
  };

  if (encodeURIComponent(defaultedOptions.key) === defaultedOptions.key) {
    defaultedOptions.key = `:${defaultedOptions.key}`;
  }
  const escapedKey = escapeStringRegexp(defaultedOptions.key);
  const stateMatcher = new RegExp(`${escapedKey}=(.*);;|${escapedKey}=(.*)$`);
  const splitMatcher = new RegExp(`${escapedKey}=.*;;|${escapedKey}=.*$`);

  const parseQueryString = (querystring: string) => {
    const match = querystring.match(stateMatcher);
    if (match) {
      return parse(match[1] ?? match[2]);
    }
    return null;
  };
  let url = defaultedOptions.url;
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
      const queryString = url.search.substring(1);
      const pathname = url.pathname;
      if (!queryString) {
        return initialState;
      }
      const parsed = parseQueryString(queryString);
      if (!parsed) {
        return initialState;
      }

      const merged = mergeWith(
        cloneDeep(initialState),
        getSelectedState(parsed, pathname),
      );
      set(merged, true);
      return merged;
    } catch (error) {
      console.error(error);
      return initialState;
    }
  };

  if (typeof window !== 'undefined') {
    const decodeHref = () => {
      let href = location.href;
      let decoded = decodeURIComponent(href);

      if (
        decoded.indexOf(`?${defaultedOptions.key}=`) !==
        href.indexOf(`?${defaultedOptions.key}=`)
      ) {
        href = decoded;
        decoded = decodeURIComponent(href);
      }

      return href;
    };
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
      const url = new URL(decodeHref());
      const selectedState = getSelectedState(get(), url.pathname);
      const currentQueryString = url.search;
      const currentParsed = parseQueryString(currentQueryString);

      const newMerged = {
        ...currentParsed,
        ...selectedState,
      };

      const splitIgnored = currentQueryString.split(splitMatcher);
      let ignored = '';
      for (let str of splitIgnored) {
        if (!str || str === '?' || str === '&') {
          continue;
        }
        if (str.startsWith('&') || str.startsWith('?')) {
          str = str.substring(1);
        }
        if (str.endsWith('&')) {
          str = str.substring(0, str.length - 1);
        }
        ignored += (ignored ? '&' : '?') + str;
      }

      const newCompacted = compact(newMerged, initialState);
      let newQueryString = '';
      if (Object.keys(newCompacted).length) {
        const stringified = stringify(newCompacted);
        const newQueryState = `${defaultedOptions.key}=${stringified};;`;
        if (currentParsed) {
          newQueryString = currentQueryString.replace(
            splitMatcher,
            newQueryState,
          );
        } else if (ignored) {
          newQueryString = ignored + '&' + newQueryState;
        } else {
          newQueryString = '?' + newQueryState;
        }
      } else {
        newQueryString = ignored;
      }

      const currentUrl = location.pathname + location.search;
      const newUrl = location.pathname + newQueryString;

      if (newUrl !== currentUrl) {
        history.replaceState(history.state, '', newUrl);
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

    return initialize(new URL(decodeHref()), initialState);
  } else if (url) {
    url = decodeURIComponent(url);
    const idx = url.indexOf(`?${defaultedOptions.key}=`);
    const decoded = decodeURIComponent(url);
    if (decoded.indexOf(`?${defaultedOptions.key}=`) !== idx) {
      url = decoded;
    }
    return initialize(new URL(url, 'http://localhost'), fn(set, get, api));
  }

  return fn(set, get, api);
};

export const querystring = queryStringImpl as unknown as QueryString;
