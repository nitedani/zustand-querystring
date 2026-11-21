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

import type {
  ParseContext,
  QueryStringFormat,
  QueryStringParams,
} from '../middleware.js';
import { getOwn, setOwn } from '../own.js';

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
  /** String representation of Infinity @default 'Infinity' */
  infinityString?: string;
  /** String representation of -Infinity @default '-Infinity' */
  negativeInfinityString?: string;
  /** String representation of NaN @default 'NaN' */
  nanString?: string;
}

interface ResolvedOptions {
  entrySep: string;
  nestingSep: string;
  arraySep: 'repeat' | string;
  escape: string;
  nullStr: string;
  undefStr: string;
  infStr: string;
  negInfStr: string;
  nanStr: string;
}

function resolveOptions(opts: PlainFormatOptions = {}): ResolvedOptions {
  return {
    entrySep: opts.entrySeparator ?? ',',
    nestingSep: opts.nestingSeparator ?? '.',
    arraySep: opts.arraySeparator ?? 'repeat',
    escape: opts.escapeChar ?? '_',
    nullStr: opts.nullString ?? 'null',
    undefStr: opts.undefinedString ?? 'undefined',
    infStr: opts.infinityString ?? 'Infinity',
    negInfStr: opts.negativeInfinityString ?? '-Infinity',
    nanStr: opts.nanString ?? 'NaN',
  };
}

function validateOptions(opts: ResolvedOptions): void {
  const { entrySep, nestingSep, arraySep, escape } = opts;

  if (entrySep === nestingSep) {
    throw new Error(
      `entrySeparator and nestingSeparator cannot be the same: '${entrySep}'`,
    );
  }
  if (escape === entrySep || escape === nestingSep) {
    throw new Error(
      `escapeChar cannot be the same as a separator: '${escape}'`,
    );
  }
  if (arraySep !== 'repeat' && arraySep === nestingSep) {
    throw new Error(
      `arraySeparator cannot be the same as nestingSeparator: '${arraySep}'`,
    );
  }
  if (arraySep !== 'repeat' && arraySep === escape) {
    throw new Error(
      `arraySeparator cannot be the same as escapeChar: '${arraySep}'`,
    );
  }
  if (entrySep.length === 0 || nestingSep.length === 0 || escape.length === 0) {
    throw new Error('Separators and escape character cannot be empty');
  }
  if (arraySep !== 'repeat' && arraySep.length === 0) {
    throw new Error('arraySeparator cannot be empty');
  }
  if ([...escape].length !== 1) {
    throw new Error(`escapeChar must be a single character: '${escape}'`);
  }
  const tokens = [escape, '=', '%', entrySep, nestingSep];
  if (arraySep !== 'repeat' && arraySep !== entrySep) tokens.push(arraySep);
  for (const [i, token] of tokens.entries()) {
    const other = tokens
      .slice(i + 1)
      .find(t => [...t].some(c => token.includes(c)));
    if (other !== undefined) {
      throw new Error(
        `escapeChar, separators, '=' and '%' cannot share characters: '${token}' and '${other}'`,
      );
    }
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
  const markers = new Set([opts.entrySep, opts.nestingSep, opts.escape, '=']);
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
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !isDate(value)
  );
}

// =============================================================================
// PARSING PRIMITIVES
// =============================================================================

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
// Supports: integers, decimals, scientific notation (1e10, 1.5e-3, etc.)
const NUMBER_RE = /^-?(\d+\.?\d*|\d*\.?\d+)([eE][+-]?\d+)?$/;

function tryParseBoolean(str: string): boolean | null {
  if (str === 'true') return true;
  if (str === 'false') return false;
  return null;
}

function tryParseNumber(str: string, opts: ResolvedOptions): number | null {
  // Check special number strings first
  if (str === opts.infStr) return Infinity;
  if (str === opts.negInfStr) return -Infinity;
  if (str === opts.nanStr) return NaN;

  // Check regular number pattern
  if (!NUMBER_RE.test(str)) return null;
  const n = parseFloat(str);
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
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return opts.nanStr;
    if (value === Infinity) return opts.infStr;
    if (value === -Infinity) return opts.negInfStr;
    return String(value);
  }
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
function parseValue(
  str: string,
  hint: unknown,
  opts: ResolvedOptions,
): unknown {
  // Special strings
  if (str === opts.nullStr) return null;
  if (str === opts.undefStr) return undefined;
  if (str === '') return '';

  // Type hint coercion
  if (hint !== null && hint !== undefined) {
    if (typeof hint === 'string') return str;

    if (typeof hint === 'number') {
      const n = tryParseNumber(str, opts);
      if (n !== null || Number.isNaN(n)) return n;
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

  const n = tryParseNumber(str, opts);
  if (n !== null || Number.isNaN(n)) return n;

  return str;
}

// =============================================================================
// ESCAPING
// =============================================================================

/**
 * Whether the char at i goes after an escape char: a char of the special
 * chars, or the escape char where a reader would take it as an escape (before
 * itself, a special char, or the end).
 */
function isEscaped(cs: string[], i: number, chars: string[], esc: string) {
  const isSpecial = (c: string) => chars.some(special => special.includes(c));
  return (
    isSpecial(cs[i]) ||
    (cs[i] === esc &&
      (i + 1 === cs.length || cs[i + 1] === esc || isSpecial(cs[i + 1])))
  );
}

/**
 * Escape special characters in a string.
 */
function escape(str: string, chars: string[], esc: string): string {
  return [...str]
    .map((c, i, cs) => (isEscaped(cs, i, chars, esc) ? esc + c : c))
    .join('');
}

/**
 * Remove escape sequences from a string.
 */
function unescape(str: string, esc: string, chars: string[]): string {
  const cs = [...str];
  let result = '';
  for (let i = 0; i < cs.length; i++) {
    if (
      cs[i] === esc &&
      i + 1 < cs.length &&
      isEscaped(cs, i + 1, chars, esc)
    ) {
      i++;
    }
    result += cs[i];
  }
  return result;
}

/**
 * Split a string by separator, respecting escape sequences.
 */
function splitEscaped(str: string, sep: string, esc: string): string[] {
  const parts: string[] = [];
  let current = '';
  let i = 0;

  while (i < str.length) {
    // An escape char and the char after it are kept as-is for unescape
    if (str.startsWith(esc, i)) {
      current += str.slice(i, i + esc.length + 1);
      i += esc.length + 1;
      continue;
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
 * Returns -1 if not found.
 */
function findUnescaped(str: string, char: string, esc: string): number {
  let i = 0;

  while (i < str.length) {
    // Skip an escape char and the char after it
    if (str.startsWith(esc, i)) {
      i += esc.length + 1;
      continue;
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
  return segments.map(seg => unescape(seg, opts.escape, keySpecials));
}

/**
 * Get type hint at a path in the initial state.
 */
function getHintAtPath(state: object, path: string[]): unknown {
  let current: unknown = state;

  for (const key of path) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object'
    ) {
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
function setAtPath(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown,
): void {
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const nextKey = path[i + 1];
    const nextIsIndex = /^\d+$/.test(nextKey);

    if (getOwn(current, key) === undefined) {
      setOwn(current, key, nextIsIndex ? [] : {});
    }

    current = current[key] as Record<string, unknown>;
  }

  const lastKey = path[path.length - 1];

  if (/^\d+$/.test(lastKey)) {
    (current as unknown as unknown[])[parseInt(lastKey, 10)] = value;
  } else {
    setOwn(current, lastKey, value);
  }
}

// =============================================================================
// FLATTENING (object → flat entries)
// =============================================================================

type FlatEntries = Record<string, string[]>;

/**
 * Flatten an object to dot-notation key-value pairs.
 */
function flatten(
  obj: object,
  prefix: string,
  opts: ResolvedOptions,
): FlatEntries {
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

      const hasObjects = value.some(item => isObject(item));

      if (hasObjects) {
        // Array of objects: use indexed keys
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          const indexedKey = fullKey + opts.nestingSep + i;

          if (isObject(item)) {
            Object.assign(result, flatten(item, indexedKey, opts));
          } else {
            const serialized = serializeValue(item, opts);
            const escapedValue = escape(
              serialized,
              valueEscapeChars,
              opts.escape,
            );
            result[indexedKey] = [escapedValue];
          }
        }
      } else {
        // Simple array
        result[fullKey] = value.map(item => {
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
function unflatten(
  entries: FlatEntries,
  initialState: object,
  opts: ResolvedOptions,
): object {
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

    // Characters that may be escaped in values
    const valueSpecials: string[] = [opts.entrySep];
    if (opts.arraySep !== 'repeat') {
      valueSpecials.push(opts.arraySep);
    }

    const unescapeValue = (v: string) =>
      unescape(v, opts.escape, valueSpecials);

    // ── Step 1: Determine if this is an array ──
    //
    // Three ways a value can be an array:
    //   a) Multiple raw values (arraySep='repeat' mode, e.g. ?tag=a&tag=b)
    //   b) A single raw value containing unescaped arraySep (e.g. "Blackwell,Ada")
    //   c) initialState says it's an array (isArrayHint)
    //
    // Escaped separators (e.g. "_,") are NOT split — splitEscaped skips them.
    // So an unescaped separator always means "array boundary", even without a hint.
    //
    // We must split BEFORE unescaping, otherwise "_," becomes "," and looks
    // like a real separator.

    let values: string[];
    if (opts.arraySep !== 'repeat' && rawValues.length === 1) {
      // (b) Try splitting the single raw value on unescaped arraySep
      const parts = splitEscaped(rawValues[0], opts.arraySep, opts.escape);
      // (c) Or initialState says it's an array
      const isArray = parts.length > 1 || isArrayHint;
      values = isArray
        ? parts.map(unescapeValue) // split into array elements, then unescape each
        : [unescapeValue(rawValues[0])]; // single scalar, just unescape
    } else {
      // (a) Already multiple raw values (repeat mode, e.g. ?tag=a&tag=b)
      values = rawValues.map(unescapeValue);
    }

    // ── Step 2: Store the parsed value ──

    // Empty array: single empty string + array hint → []
    if (values.length === 1 && values[0] === '' && isArrayHint) {
      setAtPath(result, path, []);
      continue;
    }

    // Single scalar value
    if (values.length === 1 && !isArrayHint) {
      setAtPath(result, path, parseValue(values[0], hint, opts));
      continue;
    }

    // Array (multiple values, or single value with array hint)
    const elementHint = isArrayHint ? hint[0] : undefined;
    setAtPath(
      result,
      path,
      values.map(v => parseValue(v, elementHint, opts)),
    );
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
        parts.push(
          encodePreservingMarkers(key, opts) +
            '=' +
            encodePreservingMarkers(value, opts),
        );
      }
    } else {
      // Join array values with arraySep
      parts.push(
        encodePreservingMarkers(key, opts) +
          '=' +
          encodePreservingMarkers(values.join(opts.arraySep), opts),
      );
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
function stringifyStandalone(
  state: object,
  opts: ResolvedOptions,
): QueryStringParams {
  const entries = flatten(state, '', opts);
  const result: QueryStringParams = {};

  for (const [key, values] of Object.entries(entries)) {
    const encodedKey = encodePreservingMarkers(key, opts);
    const encodedValues = values.map(v => encodePreservingMarkers(v, opts));

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
  opts: ResolvedOptions,
): object {
  const entries: FlatEntries = {};

  for (const [key, values] of Object.entries(params)) {
    const decodedKey = decodeString(key);
    entries[decodedKey] = values.map(v => decodeString(v));
  }

  return unflatten(entries, initialState, opts);
}

// =============================================================================
// FORMAT FACTORY
// =============================================================================

/**
 * Create a plain format with custom configuration.
 */
export function createFormat(
  options: PlainFormatOptions = {},
): QueryStringFormat {
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
 * - Array separator: `repeat` (repeated keys, e.g. `?tag=a&tag=b`)
 * - Escape character: `_`
 */
export const plain: QueryStringFormat = createFormat();
