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

import type { QueryStringFormat, QueryStringParams, ParseContext } from '../middleware.js';

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
  /** Escape character @default '/' */
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
    escape: opts.escapeChar ?? '/',
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
    throw new Error(`datePrefix '${opts.datePrefix}' conflicts with another token`);
  }
}

// =============================================================================
// REGEX BUILDERS
// =============================================================================

function escapeRegex(str: string): string {
  return str.replace(/[.$^*+?()[\]{}|\\-]/g, '\\$&');
}

function buildKeyStopPattern(opts: ResolvedOptions): RegExp {
  return new RegExp(
    `[${escapeRegex(opts.typeString)}${escapeRegex(opts.typePrimitive)}${escapeRegex(opts.typeArray)}${escapeRegex(opts.typeObject)}${escapeRegex(opts.separator)}]`,
  );
}

function buildValueStopPattern(opts: ResolvedOptions): RegExp {
  return new RegExp(`[${escapeRegex(opts.separator)}${escapeRegex(opts.terminator)}]`);
}

function buildKeyEscapePattern(opts: ResolvedOptions): RegExp {
  return new RegExp(
    `([${escapeRegex(opts.typeString)}${escapeRegex(opts.typePrimitive)}${escapeRegex(opts.typeArray)}${escapeRegex(opts.typeObject)}${escapeRegex(opts.escape)}${escapeRegex(opts.separator)}])`,
    'g',
  );
}

function buildValueEscapePattern(opts: ResolvedOptions): RegExp {
  return new RegExp(`([${escapeRegex(opts.separator)}${escapeRegex(opts.terminator)}${escapeRegex(opts.escape)}])`, 'g');
}

function buildDatePattern(opts: ResolvedOptions): RegExp {
  return new RegExp(`^${escapeRegex(opts.datePrefix)}-?\\d+$`);
}

function buildDateStartPattern(opts: ResolvedOptions): RegExp {
  return new RegExp(`^${escapeRegex(opts.datePrefix)}-?\\d`);
}

// =============================================================================
// HELPERS
// =============================================================================

function escapeStr(str: string, pattern: RegExp, escape: string): string {
  return encodeURI(str.replace(pattern, `${escape}$1`));
}

function cleanResult(str: string, standalone: boolean, opts: ResolvedOptions): string {
  while (str.endsWith(opts.terminator)) {
    str = str.slice(0, -opts.terminator.length);
  }

  const datePattern = new RegExp(`^${escapeRegex(opts.typeString)}${escapeRegex(opts.datePrefix)}-?\\d+$`);
  if (standalone && datePattern.test(str)) {
    return str.slice(opts.typeString.length);
  }

  if (!standalone && str.startsWith(opts.typeObject)) {
    return str.slice(opts.typeObject.length);
  }

  return str;
}

// =============================================================================
// SERIALIZATION
// =============================================================================

function createSerializer(opts: ResolvedOptions) {
  const keyEscape = buildKeyEscapePattern(opts);
  const valueEscape = buildValueEscapePattern(opts);
  const dateStartPattern = buildDateStartPattern(opts);

  function serialize(value: unknown, standalone: boolean, inArray: boolean = false): string {
    if (value === null) return `${opts.typePrimitive}null`;
    if (value === undefined) return `${opts.typePrimitive}undefined`;
    if (typeof value === 'function') return '';

    if (typeof value === 'number') {
      return `${opts.typePrimitive}${String(value).replace(/\./g, `${opts.escape}.`)}`;
    }

    if (typeof value === 'boolean') {
      return `${opts.typePrimitive}${value}`;
    }

    if (value instanceof Date) {
      return `${opts.typeString}${opts.datePrefix}${value.getTime()}`;
    }

    if (Array.isArray(value)) {
      const items = value.map((v) => serialize(v, standalone, true));
      return `${opts.typeArray}${items.join(opts.separator)}${opts.terminator}`;
    }

    if (typeof value === 'object') {
      const entries: string[] = [];
      for (const [k, v] of Object.entries(value)) {
        const val = serialize(v, false, false);
        if (val || v === undefined) {
          entries.push(`${escapeStr(k, keyEscape, opts.escape)}${val}`);
        }
      }
      return `${opts.typeObject}${entries.join(opts.separator)}${opts.terminator}`;
    }

    // String: escape date-like pattern
    const strVal = String(value);
    let escaped = escapeStr(strVal, valueEscape, opts.escape);
    if (dateStartPattern.test(strVal)) {
      escaped = opts.escape + escaped;
    }

    return standalone || inArray ? escaped : `${opts.typeString}${escaped}`;
  }

  return serialize;
}

// =============================================================================
// PARSING
// =============================================================================

function createParser(opts: ResolvedOptions) {
  const keyStop = buildKeyStopPattern(opts);
  const valueStop = buildValueStopPattern(opts);
  const datePattern = buildDatePattern(opts);

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

    function peek(len: number = 1): string {
      return source.slice(pos, pos + len);
    }

    function startsWith(token: string): boolean {
      return source.slice(pos, pos + token.length) === token;
    }

    function advance(len: number = 1): void {
      pos += len;
    }

    function readUntil(
      stopPattern: RegExp,
      checkEscape: boolean = false,
    ): { value: string; wasEscaped: boolean } {
      let result = '';
      let wasEscaped = false;

      while (pos < source.length) {
        // Check for escape sequence
        if (startsWith(tokens.escape)) {
          if (checkEscape && source.slice(pos + tokens.escape.length, pos + tokens.escape.length + tokens.datePrefix.length) === tokens.datePrefix) {
            wasEscaped = true;
          }
          advance(tokens.escape.length);
          /* v8 ignore next 4 -- @preserve: defensive - handles escape char at very end of source */
          if (pos < source.length) {
            result += peek();
            advance();
          }
          continue;
        }

        const ch = peek();
        if (stopPattern.test(ch)) break;
        result += ch;
        advance();
      }

      return { value: result, wasEscaped };
    }

    function parseString(): string | Date {
      const { value, wasEscaped } = readUntil(valueStop, true);

      if (!wasEscaped && datePattern.test(value)) {
        const timestamp = parseInt(value.slice(tokens.datePrefix.length), 10);
        /* v8 ignore next 3 -- @preserve: defensive - parseInt on digit string won't produce NaN */
        if (!isNaN(timestamp)) {
          return new Date(timestamp);
        }
      }

      return value;
    }

    function parsePrimitive(): number | boolean | null | undefined {
      const { value } = readUntil(valueStop, false);
      if (value === 'null') return null;
      if (value === 'undefined') return undefined;
      if (value === 'true') return true;
      if (value === 'false') return false;
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
          result.push(parseValue());
        } else {
          result.push(parseString());
        }

        if (pos < source.length && startsWith(tokens.separator)) {
          advance(tokens.separator.length);
          lastWasSeparator = true;
        }
      }

      if (lastWasSeparator && (startsWith(tokens.terminator) || pos >= source.length)) {
        result.push('');
      }

      if (startsWith(tokens.terminator)) advance(tokens.terminator.length);
      return result;
    }

    function parseObject(): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      while (pos < source.length && !startsWith(tokens.terminator)) {
        const { value: key } = readUntil(keyStop, false);
        result[key] = parseValue();
        if (pos < source.length && !startsWith(tokens.terminator) && startsWith(tokens.separator)) {
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
        return parseString();
      }

      /* v8 ignore next 2 -- @preserve: defensive code - all valid types are handled above */
      throw new Error(`Unexpected type "${peek()}" at position ${pos}`);
    }

    return parseValue() as T;
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
  return cleanResult(serialize(value, standalone), standalone, opts);
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
  const str = decodeURI(input);

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
    // Unescape the string value - remove escape characters before special chars
    let result = '';
    for (let i = 0; i < str.length; i++) {
      if (str.slice(i, i + opts.escape.length) === opts.escape && i + opts.escape.length < str.length) {
        // Skip escape char, take next char literally
        i += opts.escape.length - 1;
        result += str[i + 1];
        i++;
      } else {
        result += str[i];
      }
    }
    return result as T;
  } else {
    // Build pattern for detecting if this looks like object data
    const escapedMarkers = [opts.typeString, opts.typePrimitive, opts.typeArray, opts.typeObject]
      .map(escapeRegex)
      .join('');
    const escapedEscape = escapeRegex(opts.escape);
    const escapedSeparator = escapeRegex(opts.separator);
    const escapedTerminator = escapeRegex(opts.terminator);
    const objectPattern = new RegExp(
      `[^${escapedEscape}${escapedMarkers}${escapedSeparator}${escapedTerminator}][${escapedMarkers}]`,
    );
    source = objectPattern.test(str) ? `${opts.typeObject}${str}` : `${opts.typeString}${str}`;
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
export function createFormat(options: MarkedFormatOptions = {}): QueryStringFormat {
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
        result[encodeURI(key)] = [stringify(value, true, options)];
      }
      return result;
    },

    parseStandalone(params: QueryStringParams, _ctx: ParseContext): object {
      const result: Record<string, unknown> = {};
      for (const [key, values] of Object.entries(params)) {
        if (values.length > 0) {
          result[decodeURI(key)] = parse(values[0], true, options);
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
 * - Escape: `/`
 * - Date prefix: `D`
 */
export const marked: QueryStringFormat = createFormat();

export default marked;
