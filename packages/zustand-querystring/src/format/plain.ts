/**
 * Plain URL Query String Format
 *
 * A simple format for URL state serialization with optional configuration.
 *
 * Features:
 * - Dot notation for nested objects: user.name=John
 * - Repeated keys for arrays: tags=a&tags=b&tags=c
 * - Proper escaping of special characters in both keys and values
 * - Auto-parsing of numbers, booleans, and ISO dates
 * - Type coercion from initialState when available
 *
 * Two modes:
 * - Namespaced: entire state in one param (key: 'state')
 * - Standalone: each field as separate param (key: false)
 */

import type { ParseContext, QueryStringFormat, QueryStringParams } from '../middleware.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface PlainFormatOptions {
  /** Separator between key=value entries in namespaced mode @default ',' */
  entrySeparator?: string;
  /** Separator for nested keys (e.g., user.name) @default '.' */
  nestingSeparator?: string;
  /** Array separator: 'repeat' for repeated keys, or string to join values @default 'repeat' */
  arraySeparator?: 'repeat' | string;
  /** Character used to escape special characters @default '_' */
  escapeChar?: string;
  /** String representation of null @default 'null' */
  nullString?: string;
  /** String representation of undefined @default 'undefined' */
  undefinedString?: string;
}

interface ResolvedOptions {
  entrySep: string;
  nestingSep: string;
  arraySep: 'repeat' | string;
  escape: string;
  nullStr: string;
  undefStr: string;
}

function resolveOptions(opts: PlainFormatOptions = {}): ResolvedOptions {
  return {
    entrySep: opts.entrySeparator ?? ',',
    nestingSep: opts.nestingSeparator ?? '.',
    arraySep: opts.arraySeparator ?? ',',
    escape: opts.escapeChar ?? '_',
    nullStr: opts.nullString ?? 'null',
    undefStr: opts.undefinedString ?? 'undefined',
  };
}

function validateOptions(opts: ResolvedOptions): void {
  const { entrySep, nestingSep, arraySep, escape } = opts;

  if (entrySep === nestingSep) {
    throw new Error(`entrySeparator and nestingSeparator cannot be the same: '${entrySep}'`);
  }
  if (escape === entrySep || escape === nestingSep) {
    throw new Error(`escapeChar cannot be the same as a separator: '${escape}'`);
  }
  if (arraySep !== 'repeat' && arraySep === nestingSep) {
    throw new Error(`arraySeparator cannot be the same as nestingSeparator: '${arraySep}'`);
  }
  if (arraySep !== 'repeat' && arraySep === escape) {
    throw new Error(`arraySeparator cannot be the same as escapeChar: '${arraySep}'`);
  }
  if (entrySep.length === 0 || nestingSep.length === 0 || escape.length === 0) {
    throw new Error('Separators and escape character cannot be empty');
  }
  if (arraySep !== 'repeat' && arraySep.length === 0) {
    throw new Error('arraySeparator cannot be empty');
  }
}

// =============================================================================
// URL ENCODING
// =============================================================================

/**
 * Encode a string preserving our special markers unencoded.
 * Uses encodeURIComponent for safety but keeps separators readable.
 */
function encodePreservingMarkers(str: string, opts: ResolvedOptions): string {
  const markers = new Set([
    opts.entrySep,
    opts.nestingSep,
    opts.escape,
    '=',
  ]);
  if (opts.arraySep !== 'repeat') {
    markers.add(opts.arraySep);
  }

  let result = '';
  for (const char of str) {
    if (markers.has(char)) {
      result += char;
    } else {
      result += encodeURIComponent(char);
    }
  }
  return result;
}

/**
 * Decode a URL-encoded string.
 */
function decodeString(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !isDate(value);
}

// =============================================================================
// PARSING PRIMITIVES
// =============================================================================

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function tryParseBoolean(str: string): boolean | null {
  if (str === 'true') return true;
  if (str === 'false') return false;
  return null;
}

function tryParseNumber(str: string): number | null {
  if (!NUMBER_RE.test(str)) return null;
  const n = parseFloat(str);
  /* v8 ignore next -- @preserve: defensive - regex already filters non-finite number strings */
  return isFinite(n) ? n : null;
}

function tryParseDate(str: string): Date | null {
  if (!ISO_DATE_RE.test(str)) return null;
  const d = new Date(str);
  return isDate(d) ? d : null;
}

// =============================================================================
// SERIALIZATION
// =============================================================================

function serializeValue(value: unknown, opts: ResolvedOptions): string {
  if (value === null) return opts.nullStr;
  if (value === undefined) return opts.undefStr;
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (isDate(value)) return value.toISOString();
  return String(value);
}

// =============================================================================
// DESERIALIZATION
// =============================================================================

/**
 * Parse a string value to its typed representation.
 *
 * Strategy:
 * 1. Check special strings (null, undefined, empty)
 * 2. If type hint exists, coerce to that type
 * 3. Auto-parse: boolean → date → number → string
 */
function parseValue(str: string, hint: unknown, opts: ResolvedOptions): unknown {
  // Special strings
  if (str === opts.nullStr) return null;
  if (str === opts.undefStr) return undefined;
  if (str === '') return '';

  // Type hint coercion
  if (hint !== null && hint !== undefined) {
    if (typeof hint === 'string') return str;

    if (typeof hint === 'number') {
      const n = tryParseNumber(str);
      if (n !== null) return n;
    }

    if (typeof hint === 'boolean') {
      const b = tryParseBoolean(str);
      if (b !== null) return b;
    }

    if (isDate(hint)) {
      const d = tryParseDate(str);
      if (d !== null) return d;
    }

    /* v8 ignore next 3 -- @preserve: defensive code - unflatten always extracts hint[0] before calling parseValue */
    if (Array.isArray(hint) && hint[0] !== undefined) {
      return parseValue(str, hint[0], opts);
    }
  }

  // Auto-parse (order: boolean → date → number → string)
  const b = tryParseBoolean(str);
  if (b !== null) return b;

  const d = tryParseDate(str);
  if (d !== null) return d;

  const n = tryParseNumber(str);
  if (n !== null) return n;

  return str;
}

// =============================================================================
// ESCAPING
// =============================================================================

/**
 * Escape special characters in a string.
 * Only special chars need escaping. The escape char itself NEVER needs escaping.
 */
function escape(str: string, chars: string[], esc: string): string {
  let result = '';
  let i = 0;

  while (i < str.length) {
    let matched = false;

    // Check if current position starts with any special char that needs escaping
    for (const special of chars) {
      if (str.substring(i, i + special.length) === special) {
        result += esc + special;
        i += special.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += str[i];
      i++;
    }
  }

  return result;
}

/**
 * Remove escape sequences from a string.
 * Only treat escape char as escape when followed by a special char.
 */
function unescape(str: string, esc: string, chars: string[]): string {
  let result = '';
  let i = 0;

  while (i < str.length) {
    // Check if current position starts with escape char
    if (str.substring(i, i + esc.length) === esc) {
      const nextPos = i + esc.length;
      // Check if followed by a special char (NOT another escape)
      const isEscapeSequence = chars.some(c => str.substring(nextPos, nextPos + c.length) === c);
      
      if (isEscapeSequence && nextPos < str.length) {
        // Skip escape char, take next char(s) literally
        i = nextPos;
        // Find which special char follows
        for (const special of chars) {
          if (str.substring(i, i + special.length) === special) {
            result += special;
            i += special.length;
            break;
          }
        }
        continue;
      }
    }

    result += str[i];
    i++;
  }

  return result;
}

/**
 * Split a string by separator, respecting escape sequences.
 * Only treats escape char as escape when followed by sep (NOT another escape).
 */
function splitEscaped(str: string, sep: string, esc: string): string[] {
  const parts: string[] = [];
  let current = '';
  let i = 0;

  while (i < str.length) {
    // Check for escape sequence (only _ followed by separator)
    if (str.substring(i, i + esc.length) === esc) {
      const nextPos = i + esc.length;
      const isEscapeSequence = str.substring(nextPos, nextPos + sep.length) === sep;
      
      if (isEscapeSequence && nextPos < str.length) {
        // This is an escape sequence - keep it as-is for later unescape
        current += esc + sep;
        i = nextPos + sep.length;
        continue;
      }
    }

    // Check for separator
    if (str.substring(i, i + sep.length) === sep) {
      parts.push(current);
      current = '';
      i += sep.length;
      continue;
    }

    current += str[i];
    i++;
  }

  parts.push(current);
  return parts;
}

/**
 * Find unescaped index of a character in a string.
 * Only treats escape char as escape when followed by char (NOT another escape).
 * Returns -1 if not found.
 */
function findUnescaped(str: string, char: string, esc: string): number {
  let i = 0;
  
  while (i < str.length) {
    if (str.substring(i, i + esc.length) === esc) {
      const nextPos = i + esc.length;
      // Only escape sequence if followed by the char we're looking for
      if (str.substring(nextPos, nextPos + char.length) === char) {
        // Skip the escape sequence
        i = nextPos + char.length;
        continue;
      }
    }
    if (str.substring(i, i + char.length) === char) {
      return i;
    }
    i++;
  }
  return -1;
}

// =============================================================================
// KEY PATH HANDLING
// =============================================================================

/**
 * Escape a key segment for use in a dot-notation path.
 * Escapes nesting separator, entry separator, and '=' (key-value separator).
 */
function escapeKey(key: string, opts: ResolvedOptions): string {
  return escape(key, [opts.nestingSep, opts.entrySep, '='], opts.escape);
}

/**
 * Parse a dot-notation key path into segments, handling escapes.
 */
function parseKeyPath(path: string, opts: ResolvedOptions): string[] {
  const segments = splitEscaped(path, opts.nestingSep, opts.escape);
  // Keys can have nestingSep, entrySep, and = escaped
  const keySpecials = [opts.nestingSep, opts.entrySep, '='];
  return segments.map((seg) => unescape(seg, opts.escape, keySpecials));
}

/**
 * Get type hint at a path in the initial state.
 */
function getHintAtPath(state: object, path: string[]): unknown {
  let current: unknown = state;

  for (const key of path) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }

    if (Array.isArray(current)) {
      current = current[0];
      continue;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set a value at a path in an object, creating intermediate structures.
 */
function setAtPath(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const nextKey = path[i + 1];
    const nextIsIndex = /^\d+$/.test(nextKey);

    if (current[key] === undefined) {
      current[key] = nextIsIndex ? [] : {};
    }

    current = current[key] as Record<string, unknown>;
  }

  const lastKey = path[path.length - 1];

  if (/^\d+$/.test(lastKey)) {
    (current as unknown as unknown[])[parseInt(lastKey, 10)] = value;
  } else {
    current[lastKey] = value;
  }
}

// =============================================================================
// FLATTENING (object → flat entries)
// =============================================================================

type FlatEntries = Record<string, string[]>;

/**
 * Flatten an object to dot-notation key-value pairs.
 */
function flatten(obj: object, prefix: string, opts: ResolvedOptions): FlatEntries {
  const result: FlatEntries = {};
  // Characters to escape in values
  const valueEscapeChars = [opts.entrySep];
  if (opts.arraySep !== 'repeat' && opts.arraySep !== opts.entrySep) {
    valueEscapeChars.push(opts.arraySep);
  }

  for (const [rawKey, value] of Object.entries(obj)) {
    if (typeof value === 'function') continue;

    const escapedKey = escapeKey(rawKey, opts);
    const fullKey = prefix ? prefix + opts.nestingSep + escapedKey : escapedKey;

    // Primitives and dates
    if (
      value === null ||
      value === undefined ||
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'string' ||
      isDate(value)
    ) {
      const serialized = serializeValue(value, opts);
      const escapedValue = escape(serialized, valueEscapeChars, opts.escape);
      result[fullKey] = [escapedValue];
      continue;
    }

    // Arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        // Empty array: just the key with empty value
        result[fullKey] = [''];
        continue;
      }

      const hasObjects = value.some((item) => isObject(item));

      if (hasObjects) {
        // Array of objects: use indexed keys
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          const indexedKey = fullKey + opts.nestingSep + i;

          if (isObject(item)) {
            Object.assign(result, flatten(item, indexedKey, opts));
          } else {
            const serialized = serializeValue(item, opts);
            const escapedValue = escape(serialized, valueEscapeChars, opts.escape);
            result[indexedKey] = [escapedValue];
          }
        }
      } else {
        // Simple array
        result[fullKey] = value.map((item) => {
          const serialized = serializeValue(item, opts);
          return escape(serialized, valueEscapeChars, opts.escape);
        });
      }
      continue;
    }

    // Nested objects
    /* v8 ignore next 3 -- @preserve: defensive - handles non-serializable types like Symbol, Set, Map */
    if (isObject(value)) {
      Object.assign(result, flatten(value, fullKey, opts));
    }
  }

  return result;
}

// =============================================================================
// UNFLATTENING (flat entries → object)
// =============================================================================

/**
 * Unflatten entries back to a nested object.
 */
function unflatten(entries: FlatEntries, initialState: object, opts: ResolvedOptions): object {
  const result: Record<string, unknown> = {};

  // Sort by path depth (shorter first)
  const keys = Object.keys(entries).sort((a, b) => {
    const pathA = parseKeyPath(a, opts);
    const pathB = parseKeyPath(b, opts);
    return pathA.length !== pathB.length
      ? pathA.length - pathB.length
      : a.localeCompare(b);
  });

  for (const key of keys) {
    let rawValues = entries[key];
    const path = parseKeyPath(key, opts);
    const hint = getHintAtPath(initialState, path);
    const isArrayHint = Array.isArray(hint);

    // Values can have entrySep and arraySep escaped
    const valueSpecials: string[] = [opts.entrySep];
    if (opts.arraySep !== 'repeat') {
      valueSpecials.push(opts.arraySep);
    }

    // Unescape values
    let values = rawValues.map((v) => unescape(v, opts.escape, valueSpecials));

    // Empty array: empty value with array hint
    if (values.length === 1 && values[0] === '' && isArrayHint) {
      setAtPath(result, path, []);
      continue;
    }

    // Split by arraySep if needed (non-repeat mode with array hint and single value)
    if (opts.arraySep !== 'repeat' && isArrayHint && values.length === 1) {
      values = splitEscaped(values[0], opts.arraySep, opts.escape).map((v) => unescape(v, opts.escape, valueSpecials));
    }

    // Single value, not an array
    if (values.length === 1 && !isArrayHint) {
      const parsed = parseValue(values[0], hint, opts);
      setAtPath(result, path, parsed);
      continue;
    }

    // Multiple values or array hint
    const elementHint = Array.isArray(hint) ? hint[0] : undefined;
    const parsedArray = values.map((v) => parseValue(v, elementHint, opts));
    setAtPath(result, path, parsedArray);
  }

  return result;
}

// =============================================================================
// NAMESPACED MODE
// =============================================================================

/**
 * Parse namespaced string into flat entries.
 * Uses continuation logic: segments without '=' are continuations of the previous value.
 * This handles all cases uniformly - the '=' sign disambiguates entries.
 */
function parseNamespaced(input: string, opts: ResolvedOptions): FlatEntries {
  if (!input) return {};

  const decoded = decodeString(input);
  const entries: FlatEntries = {};
  const parts = splitEscaped(decoded, opts.entrySep, opts.escape);

  let currentKey: string | null = null;
  let currentParts: string[] = [];

  for (const part of parts) {
    const eqIndex = findUnescaped(part, '=', opts.escape);

    if (eqIndex !== -1) {
      // This part has key=value - finish previous and start new
      if (currentKey !== null) {
        if (!entries[currentKey]) entries[currentKey] = [];
        entries[currentKey].push(currentParts.join(opts.entrySep));
      }

      currentKey = part.slice(0, eqIndex);
      currentParts = [part.slice(eqIndex + 1)];
    } else if (currentKey !== null) {
      // Continuation of previous value
      currentParts.push(part);
    }
  }

  // Flush the last key
  if (currentKey !== null) {
    if (!entries[currentKey]) entries[currentKey] = [];
    entries[currentKey].push(currentParts.join(opts.entrySep));
  }

  return entries;
}

/**
 * Stringify to namespaced format.
 */
function stringifyNamespaced(state: object, opts: ResolvedOptions): string {
  const entries = flatten(state, '', opts);
  const parts: string[] = [];

  for (const [key, values] of Object.entries(entries)) {
    if (opts.arraySep === 'repeat') {
      // Repeated keys for arrays
      for (const value of values) {
        parts.push(encodePreservingMarkers(key, opts) + '=' + encodePreservingMarkers(value, opts));
      }
    } else {
      // Join array values with arraySep
      parts.push(encodePreservingMarkers(key, opts) + '=' + encodePreservingMarkers(values.join(opts.arraySep), opts));
    }
  }

  return parts.join(opts.entrySep);
}

// =============================================================================
// STANDALONE MODE
// =============================================================================

/**
 * Stringify to standalone URL params.
 */
function stringifyStandalone(state: object, opts: ResolvedOptions): QueryStringParams {
  const entries = flatten(state, '', opts);
  const result: QueryStringParams = {};

  for (const [key, values] of Object.entries(entries)) {
    const encodedKey = encodePreservingMarkers(key, opts);
    const encodedValues = values.map((v) => encodePreservingMarkers(v, opts));

    if (opts.arraySep === 'repeat') {
      result[encodedKey] = encodedValues;
    } else {
      // Join array values with arraySep
      result[encodedKey] = [encodedValues.join(opts.arraySep)];
    }
  }

  return result;
}

/**
 * Parse standalone URL params.
 */
function parseStandalone(
  params: QueryStringParams,
  initialState: object,
  opts: ResolvedOptions
): object {
  const entries: FlatEntries = {};

  for (const [key, values] of Object.entries(params)) {
    const decodedKey = decodeString(key);
    entries[decodedKey] = values.map((v) => decodeString(v));
  }

  return unflatten(entries, initialState, opts);
}

// =============================================================================
// FORMAT FACTORY
// =============================================================================

/**
 * Create a plain format with custom configuration.
 */
export function createFormat(options: PlainFormatOptions = {}): QueryStringFormat {
  const opts = resolveOptions(options);
  validateOptions(opts);

  return {
    stringify(state: object): string {
      return stringifyNamespaced(state, opts);
    },

    parse(input: string, ctx?: ParseContext): object {
      const entries = parseNamespaced(input, opts);
      return unflatten(entries, ctx?.initialState ?? {}, opts);
    },

    stringifyStandalone(state: object): QueryStringParams {
      return stringifyStandalone(state, opts);
    },

    parseStandalone(params: QueryStringParams, ctx: ParseContext): object {
      return parseStandalone(params, ctx.initialState, opts);
    },
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

/**
 * Default plain format with standard configuration.
 *
 * - Entry separator: `,`
 * - Nesting separator: `.`
 * - Array separator: `,` (comma-separated values)
 * - Escape character: `_`
 */
export const plain: QueryStringFormat = createFormat();
