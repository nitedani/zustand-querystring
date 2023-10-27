import { parse, stringify } from './parser.js';

const escapeStringRegexp = string => {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string');
  }

  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
};

const parseQueryString = (key: string, querystring: string) => {
  const stateMatcher = new RegExp(`${key}=(.*);;|${key}=(.*)$`);
  const match = querystring.match(stateMatcher);
  if (match) {
    return parse(match[1] ?? match[2]);
  }
  return null;
};

export const createURL = ({
  baseUrl,
  key,
  state,
}: {
  baseUrl: string;
  key: string;
  state: Object;
}) => {
  const escapedKey = escapeStringRegexp(key);
  const stringified = stringify(state);
  const newQueryState = `${key}=${stringified};;`;
  const match = baseUrl.indexOf('?');
  const currentQueryString = match >= 0 ? baseUrl.substring(match) : '';
  const currentParsed = parseQueryString(escapedKey, currentQueryString);
  const splitMatcher = new RegExp(`${escapedKey}=.*;;|${escapedKey}=.*$`);

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

  let newQueryString = '';
  if (currentParsed) {
    newQueryString = currentQueryString.replace(splitMatcher, newQueryState);
  } else if (ignored) {
    newQueryString = ignored + '&' + newQueryState;
  } else {
    newQueryString = '?' + newQueryState;
  }
  if (currentQueryString) {
    return baseUrl.replace(currentQueryString, newQueryString);
  }
  return baseUrl + newQueryString;
};
