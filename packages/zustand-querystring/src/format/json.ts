import type {
  ParseContext,
  QueryStringFormat,
  QueryStringParams,
} from '../middleware.js';
import { decodeComponent } from './decode.js';

function encodeValue(input: unknown): string {
  // encodeURI leaves &, # and + as written: & splits the query, # ends it, and + reads as a space in form decoding.
  return encodeURI(JSON.stringify(input)).replace(/[&#+]/g, encodeURIComponent);
}

function decodeValue(str: string): unknown {
  return JSON.parse(decodeComponent(str));
}

export const json: QueryStringFormat = {
  stringify(state: object): string {
    return encodeValue(state);
  },

  parse(value: string, _ctx?: ParseContext): object {
    return decodeValue(value) as object;
  },

  stringifyStandalone(state: object): QueryStringParams {
    const result: QueryStringParams = {};
    for (const [key, v] of Object.entries(state)) {
      result[key] = [encodeValue(v)];
    }
    return result;
  },

  parseStandalone(params: QueryStringParams, _ctx: ParseContext): object {
    const result: Record<string, unknown> = {};
    for (const [key, values] of Object.entries(params)) {
      try {
        // Always use first value (json format doesn't use repeated keys)
        result[key] = decodeValue(values[0]);
      } catch {
        // skip invalid values
      }
    }
    return result;
  },
};
