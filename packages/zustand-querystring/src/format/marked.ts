/**
 * URL-Safe Serialization (Marked Format)
 *
 * Inspired by URLON (https://github.com/cerebral/urlon)
 * Copyright (c) 2021 Cerebral - MIT License
 *
 * A marked format for URL state serialization with configurable tokens.
 *
 * Features:
 * - Type markers for objects, arrays, strings, and primitives
 * - Nested structures with terminators
 * - Proper escaping of special characters
 * - Date serialization with configurable prefix
 *
 * Two modes:
 * - Namespaced: entire state in one param
 * - Standalone: each field as separate param
 */

import type {
  QueryStringFormat,
  QueryStringParams,
  ParseContext,
} from '../middleware.js';
import { decodeComponent } from './decode.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface MarkedFormatOptions {
  /** Marker for object type @default '.' */
  typeObject?: string;
  /** Marker for array type @default '@' */
  typeArray?: string;
  /** Marker for string type @default '=' */
  typeString?: string;
  /** Marker for primitive type (number, boolean, null, undefined) @default ':' */
  typePrimitive?: string;
  /** Separator between entries @default ',' */
  separator?: string;
  /** Terminator for nested structures @default '~' */
  terminator?: string;
  /** Escape character @default '_' */
  escapeChar?: string;
  /** Prefix for date values @default 'D' */
  datePrefix?: string;
}

interface ResolvedOptions {
  typeObject: string;
  typeArray: string;
  typeString: string;
  typePrimitive: string;
  separator: string;
  terminator: string;
  escape: string;
  datePrefix: string;
}

function resolveOptions(opts: MarkedFormatOptions = {}): ResolvedOptions {
  return {
    typeObject: opts.typeObject ?? '.',
    typeArray: opts.typeArray ?? '@',
    typeString: opts.typeString ?? '=',
    typePrimitive: opts.typePrimitive ?? ':',
    separator: opts.separator ?? ',',
    terminator: opts.terminator ?? '~',
    escape: opts.escapeChar ?? '_',
    datePrefix: opts.datePrefix ?? 'D',
  };
}

function validateOptions(opts: ResolvedOptions): void {
  const tokens = [
    opts.typeObject,
    opts.typeArray,
    opts.typeString,
    opts.typePrimitive,
    opts.separator,
    opts.terminator,
    opts.escape,
  ];

  // Check for empty values
  for (const token of tokens) {
    if (token.length === 0) {
      throw new Error('All tokens must be non-empty strings');
    }
  }

  if (opts.datePrefix.length === 0) {
    throw new Error('datePrefix must be non-empty');
  }

  // Check for duplicates among critical tokens
  const seen = new Set<string>();
  for (const token of tokens) {
    if (seen.has(token)) {
      throw new Error(`Duplicate token detected: '${token}'`);
    }
    seen.add(token);
  }

  // Date prefix shouldn't conflict with type markers
  if (seen.has(opts.datePrefix)) {
    throw new Error(
      `datePrefix '${opts.datePrefix}' conflicts with another token`,
    );
  }

  // No shared characters, so the reader can tell each token from text and from the others
  const all = [...tokens, opts.datePrefix];
  for (const [i, a] of all.entries()) {
    for (const b of all.slice(i + 1)) {
      const ch = [...a].find(c => b.includes(c));
      if (ch) {
        throw new Error(`Tokens '${a}' and '${b}' share the character '${ch}'`);
      }
    }
  }
}

// =============================================================================
// REGEX BUILDERS
// =============================================================================

function escapeRegex(str: string): string {
  return str.replace(/[.$^*+?()[\]{}|\\-]/g, '\\$&');
}

// Stop and escape patterns match one char, a surrogate pair included (the u flag), as readEscaped and escapeStr pass it
function buildKeyStopPattern(opts: ResolvedOptions): RegExp {
  return new RegExp(
    `[${escapeRegex(opts.typeString)}${escapeRegex(opts.typePrimitive)}${escapeRegex(opts.typeArray)}${escapeRegex(opts.typeObject)}${escapeRegex(opts.separator)}]`,
    'u',
  );
}

function buildValueStopPattern(opts: ResolvedOptions): RegExp {
  return new RegExp(
    `[${escapeRegex(opts.separator)}${escapeRegex(opts.terminator)}]`,
    'u',
  );
}

function buildKeyStartPattern(opts: ResolvedOptions): RegExp {
  // parseObject checks for the terminator only before a key
  return new RegExp(`^${escapeRegex(opts.terminator)}`);
}

function buildDatePattern(opts: ResolvedOptions): RegExp {
  return new RegExp(`^${escapeRegex(opts.datePrefix)}-?\\d+$`);
}

function buildDateStartPattern(opts: ResolvedOptions): RegExp {
  return new RegExp(`^${escapeRegex(opts.datePrefix)}-?\\d`);
}

function buildMarkedStartPattern(opts: ResolvedOptions): RegExp {
  const markers = [
    opts.typeObject,
    opts.typeArray,
    opts.typePrimitive,
    opts.typeString,
  ].map(escapeRegex);
  return new RegExp(
    `^(?:${escapeRegex(opts.datePrefix)}-?\\d|${markers.join('|')})`,
  );
}

// =============================================================================
// HELPERS
// =============================================================================

// Characters that are safe (not encoded by encodeURIComponent): A-Z a-z 0-9 - _ . ! ~ * ' ( )
// Our default type markers: . @ = : , ~ /
// We want to keep type markers unencoded, so we encode char-by-char and skip our markers
function encodePreservingMarkers(str: string, opts: ResolvedOptions): string {
  const markers = new Set([
    opts.typeObject,
    opts.typeArray,
    opts.typeString,
    opts.typePrimitive,
    opts.separator,
    opts.terminator,
    opts.escape,
  ]);

  let result = '';
  for (const char of str) {
    if (markers.has(char)) {
      // Keep marker unencoded
      result += char;
    } else {
      // Encode the character
      result += encodeURIComponent(char);
    }
  }
  return result;
}

// Writes str as readEscaped reads it back: the escape char before each stop char and a leading
// `start` match, and doubled where the reader would otherwise take it as an escape (before a stop
// char or a char of the escape char, at the end, or at the start before a `start` match)
function escapeStr(
  str: string,
  stop: RegExp,
  opts: ResolvedOptions,
  start?: RegExp,
): string {
  const { escape } = opts;
  const special = start?.exec(str)?.[0] ?? '';
  let out = special && escape + special;
  for (let i = special.length; i < str.length; ) {
    if (str.startsWith(escape, i)) {
      const next = charAt(str, i + escape.length);
      const ambiguous =
        next === '' ||
        stop.test(next) ||
        escape.includes(next) ||
        (i === 0 && !!start?.test(str.slice(escape.length)));
      out += ambiguous ? escape + escape : escape;
      i += escape.length;
    } else {
      const ch = charAt(str, i);
      out += stop.test(ch) ? escape + ch : ch;
      i += ch.length;
    }
  }
  return encodePreservingMarkers(out, opts);
}

// The char at i, keeping a surrogate pair whole
function charAt(str: string, i: number): string {
  const code = str.codePointAt(i);
  return code === undefined ? '' : String.fromCodePoint(code);
}

// The escape char escapes itself, an `escapable` char, or (first in the value) a `start` match; elsewhere it is literal
function readEscaped(
  source: string,
  pos: number,
  escape: string,
  stop: RegExp | null,
  escapable: RegExp,
  start?: RegExp,
): { value: string; end: number; wasEscaped: boolean } {
  const from = pos;
  let value = '';
  let wasEscaped = false;

  while (pos < source.length) {
    if (source.startsWith(escape, pos)) {
      const next = pos + escape.length;
      const special = pos === from ? start?.exec(source.slice(next)) : null;
      if (special) {
        value += special[0];
        pos = next + special[0].length;
        wasEscaped = true;
        continue;
      }
      const escaped = charAt(source, next);
      if (escapable.test(escaped)) {
        value += escaped;
        pos = next + escaped.length;
        continue;
      }
      if (source.startsWith(escape, next)) {
        value += escape;
        pos = next + escape.length;
        continue;
      }
    }

    // One char only: with a multi-character escape, the next char may start a real escape
    const ch = charAt(source, pos);
    if (stop?.test(ch)) break;
    value += ch;
    pos += ch.length;
  }

  return { value, end: pos, wasEscaped };
}

// Terminators that close the value at the end of its output, as serialize writes them
function trailingTerminators(value: unknown): number {
  if (Array.isArray(value)) {
    return (
      1 + (value.length ? trailingTerminators(value[value.length - 1]) : 0)
    );
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const last = Object.values(value)
      .filter(v => typeof v !== 'function')
      .pop();
    return 1 + trailingTerminators(last);
  }
  return 0;
}

function cleanResult(
  str: string,
  value: unknown,
  standalone: boolean,
  opts: ResolvedOptions,
): string {
  // Counted from the value: an escaped terminator can't be told from these by the chars before it
  str = str.slice(
    0,
    str.length - trailingTerminators(value) * opts.terminator.length,
  );

  const datePattern = new RegExp(
    `^${escapeRegex(opts.typeString)}${escapeRegex(opts.datePrefix)}-?\\d+$`,
  );
  if (standalone && datePattern.test(str)) {
    return str.slice(opts.typeString.length);
  }

  if (!standalone && str.startsWith(opts.typeObject)) {
    const rest = str.slice(opts.typeObject.length);
    // An empty first key leaves the value's marker first, which would read as that value
    const markers = [
      opts.typeString,
      opts.typePrimitive,
      opts.typeArray,
      opts.typeObject,
    ];
    if (!markers.some(m => rest.startsWith(m))) return rest;
  }

  return str;
}

// =============================================================================
// SERIALIZATION
// =============================================================================

function createSerializer(opts: ResolvedOptions) {
  const keyEscape = buildKeyStopPattern(opts);
  const keyStartPattern = buildKeyStartPattern(opts);
  const valueEscape = buildValueStopPattern(opts);
  const dateStartPattern = buildDateStartPattern(opts);
  const markedStartPattern = buildMarkedStartPattern(opts);

  function serialize(
    value: unknown,
    standalone: boolean,
    inArray: boolean = false,
  ): string {
    if (value === null) return `${opts.typePrimitive}null`;
    if (value === undefined) return `${opts.typePrimitive}undefined`;
    if (typeof value === 'function') return '';

    if (typeof value === 'number') {
      return `${opts.typePrimitive}${value}`;
    }

    if (typeof value === 'boolean') {
      return `${opts.typePrimitive}${value}`;
    }

    if (value instanceof Date) {
      return `${opts.typeString}${opts.datePrefix}${value.getTime()}`;
    }

    if (Array.isArray(value)) {
      const items = value.map(v => serialize(v, standalone, true));
      // A lone '' would read back as an empty array
      if (value.length === 1 && value[0] === '') items[0] = opts.typeString;
      return `${opts.typeArray}${items.join(opts.separator)}${opts.terminator}`;
    }

    if (typeof value === 'object') {
      const entries: string[] = [];
      for (const [k, v] of Object.entries(value)) {
        const val = serialize(v, false, false);
        if (val || v === undefined) {
          entries.push(
            `${escapeStr(k, keyEscape, opts, keyStartPattern)}${val}`,
          );
        }
      }
      return `${opts.typeObject}${entries.join(opts.separator)}${opts.terminator}`;
    }

    // String: escape date-like pattern and type markers (in standalone/array context) at start
    const escaped = escapeStr(
      String(value),
      valueEscape,
      opts,
      standalone || inArray ? markedStartPattern : dateStartPattern,
    );

    return standalone || inArray ? escaped : `${opts.typeString}${escaped}`;
  }

  return serialize;
}

// =============================================================================
// PARSING
// =============================================================================

// A whole number token, like the serializer's 5, -0.25, 1e+21, Infinity and NaN
const numberPattern =
  /^[+-]?(?:Infinity|NaN|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/;

// What parsePrimitive returns for a token that is no primitive (:5abc)
const unreadable = Symbol('unreadable');

function createParser(opts: ResolvedOptions) {
  const keyStop = buildKeyStopPattern(opts);
  const valueStop = buildValueStopPattern(opts);
  const keyStartPattern = buildKeyStartPattern(opts);
  const datePattern = buildDatePattern(opts);
  const dateStartPattern = buildDateStartPattern(opts);
  const markedStartPattern = buildMarkedStartPattern(opts);

  // Pre-calculate token lengths for multi-character support
  const tokens = {
    typePrimitive: opts.typePrimitive,
    typeArray: opts.typeArray,
    typeObject: opts.typeObject,
    typeString: opts.typeString,
    separator: opts.separator,
    terminator: opts.terminator,
    escape: opts.escape,
    datePrefix: opts.datePrefix,
  };

  return function parseSource<T>(source: string): T {
    let pos = 0;

    function startsWith(token: string): boolean {
      return source.slice(pos, pos + token.length) === token;
    }

    function advance(len: number = 1): void {
      pos += len;
    }

    function readUntil(
      stop: RegExp,
      start?: RegExp,
    ): { value: string; wasEscaped: boolean } {
      const read = readEscaped(source, pos, tokens.escape, stop, stop, start);
      pos = read.end;
      return read;
    }

    function parseString(start: RegExp): string | Date {
      const { value, wasEscaped } = readUntil(valueStop, start);

      if (!wasEscaped && datePattern.test(value)) {
        const timestamp = parseInt(value.slice(tokens.datePrefix.length), 10);
        /* v8 ignore next 3 -- @preserve: defensive - parseInt on digit string won't produce NaN */
        if (!isNaN(timestamp)) {
          return new Date(timestamp);
        }
      }

      return value;
    }

    function parsePrimitive():
      | number
      | boolean
      | null
      | undefined
      | typeof unreadable {
      const { value } = readUntil(valueStop);
      if (value === 'null') return null;
      if (value === 'undefined') return undefined;
      if (value === 'true') return true;
      if (value === 'false') return false;
      if (!numberPattern.test(value)) return unreadable;
      return parseFloat(value);
    }

    function parseArray(): unknown[] {
      const result: unknown[] = [];
      let lastWasSeparator = false;

      while (pos < source.length && !startsWith(tokens.terminator)) {
        if (startsWith(tokens.separator)) {
          result.push('');
          advance(tokens.separator.length);
          lastWasSeparator = true;
          continue;
        }

        lastWasSeparator = false;

        if (
          startsWith(tokens.typePrimitive) ||
          startsWith(tokens.typeArray) ||
          startsWith(tokens.typeObject) ||
          startsWith(tokens.typeString)
        ) {
          const value = parseValue();
          // An unreadable number skips only its own element
          if (value !== unreadable) result.push(value);
        } else {
          const start = pos;
          result.push(parseString(markedStartPattern));
          // Part of a multi-character token reads as nothing, and the loop would never end
          if (pos === start) {
            throw new Error(
              `Unexpected "${source.charAt(pos)}" at position ${pos}`,
            );
          }
        }

        if (pos < source.length && startsWith(tokens.separator)) {
          advance(tokens.separator.length);
          lastWasSeparator = true;
        }
      }

      if (
        lastWasSeparator &&
        (startsWith(tokens.terminator) || pos >= source.length)
      ) {
        result.push('');
      }

      if (startsWith(tokens.terminator)) advance(tokens.terminator.length);
      return result;
    }

    function parseObject(): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      while (pos < source.length && !startsWith(tokens.terminator)) {
        const { value: key } = readUntil(keyStop, keyStartPattern);
        const value = parseValue();
        if (value !== unreadable) {
          // Defined, not assigned: assigning a __proto__ key would set the prototype
          Object.defineProperty(result, key, {
            value,
            enumerable: true,
            writable: true,
            configurable: true,
          });
        }
        if (
          pos < source.length &&
          !startsWith(tokens.terminator) &&
          startsWith(tokens.separator)
        ) {
          advance(tokens.separator.length);
        }
      }
      if (startsWith(tokens.terminator)) advance(tokens.terminator.length);
      return result;
    }

    function parseValue(): unknown {
      if (startsWith(tokens.typePrimitive)) {
        advance(tokens.typePrimitive.length);
        return parsePrimitive();
      }
      if (startsWith(tokens.typeArray)) {
        advance(tokens.typeArray.length);
        return parseArray();
      }
      if (startsWith(tokens.typeObject)) {
        advance(tokens.typeObject.length);
        return parseObject();
      }
      if (startsWith(tokens.typeString)) {
        advance(tokens.typeString.length);
        return parseString(dateStartPattern);
      }

      throw new Error(
        `Unexpected type "${source.charAt(pos)}" at position ${pos}`,
      );
    }

    const isPrimitive = startsWith(tokens.typePrimitive);
    const value = parseValue();
    // A root primitive is the whole value: :90, off% is no number
    if (value === unreadable || (isPrimitive && pos < source.length)) {
      throw new Error('Unexpected primitive');
    }
    return value as T;
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Stringify a value to marked format.
 */
export function stringify(
  value: unknown,
  standalone: boolean = false,
  options: MarkedFormatOptions = {},
): string {
  const opts = resolveOptions(options);
  const serialize = createSerializer(opts);
  return cleanResult(serialize(value, standalone), value, standalone, opts);
}

/**
 * Parse a marked format string back to a value.
 */
export function parse<T = unknown>(
  input: string,
  standalone: boolean = false,
  options: MarkedFormatOptions = {},
): T {
  const opts = resolveOptions(options);
  const datePattern = buildDatePattern(opts);
  const str = decodeComponent(input);

  if (str.length === 0) {
    return (standalone ? '' : {}) as T;
  }

  // Check if string starts with any type marker (multi-character support)
  const hasMarker =
    str.startsWith(opts.typeString) ||
    str.startsWith(opts.typePrimitive) ||
    str.startsWith(opts.typeArray) ||
    str.startsWith(opts.typeObject);

  let source: string;
  if (hasMarker) {
    source = str;
  } else if (standalone) {
    if (datePattern.test(str)) {
      const timestamp = parseInt(str.slice(opts.datePrefix.length), 10);
      /* v8 ignore next 3 -- @preserve: defensive - parseInt on digit string won't produce NaN */
      if (!isNaN(timestamp)) {
        return new Date(timestamp) as T;
      }
    }
    return readEscaped(
      str,
      0,
      opts.escape,
      null,
      buildValueStopPattern(opts),
      buildMarkedStartPattern(opts),
    ).value as T;
  } else {
    // Object data has an unescaped type marker after a key
    const escapedMarkers = [
      opts.typeString,
      opts.typePrimitive,
      opts.typeArray,
      opts.typeObject,
    ]
      .map(escapeRegex)
      .join('');
    const { end } = readEscaped(
      str,
      0,
      opts.escape,
      new RegExp(`[${escapedMarkers}]`, 'u'),
      buildKeyStopPattern(opts),
    );
    source =
      end < str.length
        ? `${opts.typeObject}${str}`
        : `${opts.typeString}${str}`;
  }

  const parseSource = createParser(opts);
  return parseSource<T>(source);
}

// =============================================================================
// FORMAT FACTORY
// =============================================================================

/**
 * Create a marked format with custom configuration.
 */
export function createFormat(
  options: MarkedFormatOptions = {},
): QueryStringFormat {
  const opts = resolveOptions(options);
  validateOptions(opts);

  return {
    stringify(state: object): string {
      return stringify(state, false, options);
    },

    parse(value: string, _ctx?: ParseContext): object {
      return parse(value, false, options) as object;
    },

    stringifyStandalone(state: object): QueryStringParams {
      const result: QueryStringParams = {};
      for (const [key, value] of Object.entries(state)) {
        result[encodeURIComponent(key)] = [stringify(value, true, options)];
      }
      return result;
    },

    parseStandalone(params: QueryStringParams, ctx: ParseContext): object {
      const initialState = ctx.initialState as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [rawKey, values] of Object.entries(params)) {
        if (values.length > 0) {
          const key = decodeComponent(rawKey);
          try {
            result[key] = parse(values[0], true, options);
          } catch {
            // Text like next=./sale reads as written; a field of another type keeps its value
            const initial = initialState[key];
            if (
              initial === null ||
              initial === undefined ||
              typeof initial === 'string'
            ) {
              result[key] = decodeComponent(values[0]);
            }
          }
        }
      }
      return result;
    },
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

/**
 * Default marked format with standard configuration.
 *
 * - Type object: `.`
 * - Type array: `@`
 * - Type string: `=`
 * - Type primitive: `:`
 * - Separator: `,`
 * - Terminator: `~`
 * - Escape: `_`
 * - Date prefix: `D`
 */
export const marked: QueryStringFormat = createFormat();

export default marked;
