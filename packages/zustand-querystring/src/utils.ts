import { stringify } from './parser.js';

export const createURL = ({
  baseUrl,
  key,
  state,
}: {
  baseUrl: string;
  key: string;
  state: Object;
}) => {
  const url = new URL(baseUrl);
  const stringified = stringify(state);
  url.searchParams.set(key, stringified);
  return url.href;
};
