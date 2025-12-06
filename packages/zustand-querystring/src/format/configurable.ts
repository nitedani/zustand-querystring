/**
 * Configurable URL Query String Format
 *
 * Two serialization modes:
 * 1. TYPED MODE (typed: true) - self-describing with type markers (@, :, =)
 * 2. PLAIN MODE (typed: false) - plain values, types inferred from initialState
 */

import { z } from 'zod';
import type {
  ParseContext,
  QueryStringFormat,
  QueryStringParams,
} from '../middleware.js';

// =============================================================================
// SCHEMA
// =============================================================================

/** Serialization options for dates, booleans, null/undefined */
const serializationSchema = z.object({
  /** How to serialize dates: 'iso' or 'timestamp' @default 'timestamp' (typed) / 'iso' (plain) */
  dates: z.enum(['iso', 'timestamp']).optional(),
  /** How to serialize booleans: 'string' or 'number' @default 'string' */
  booleans: z.enum(['string', 'number']).optional(),
  /** String to represent null @default 'null' */
  null: z.string().optional(),
  /** String to represent undefined @default 'undefined' */
  undefined: z.string().optional(),
}).optional();

/** Auto-parsing options when deserializing */
const parsingSchema = z.object({
  /** Auto-detect and parse numbers @default true */
  numbers: z.boolean().optional(),
  /** Auto-detect and parse booleans @default true */
  booleans: z.boolean().optional(),
  /** Auto-detect and parse dates @default true */
  dates: z.boolean().optional(),
}).optional();

/** Separator/delimiter configuration */
const separatorsSchema = z.object({
  /** Separator between key-value pairs @default ',' */
  entry: z.string().optional(),
  /** Array separator: 'repeat' or string @default ',' */
  array: z.union([z.literal('repeat'), z.string()]).optional(),
  /** Nesting separator for object keys @default '.' */
  nesting: z.string().optional(),
  /** Escape character @default '/' */
  escape: z.string().optional(),
}).optional();

/** Type marker configuration (typed mode only) */
const markersSchema = z.object({
  /** String value marker @default '=' */
  string: z.string().optional(),
  /** Primitive marker, false to disable @default ':' */
  primitive: z.union([z.string(), z.literal(false)]).optional(),
  /** Array marker, false to disable @default '@' */
  array: z.union([z.string(), z.literal(false)]).optional(),
  /** Object/array terminator @default '~' */
  terminator: z.string().optional(),
  /** Date prefix, false to disable @default 'D' */
  datePrefix: z.union([z.string(), z.literal(false)]).optional(),
}).optional();

/** Plain mode specific options */
const plainModeSchema = z.object({
  /** Array index style: 'dot' (items.0) or 'bracket' (items[0]) @default 'dot' */
  arrayIndexStyle: z.enum(['dot', 'bracket']).optional(),
  /** Marker for empty arrays, null to omit @default '__empty_array__' */
  emptyArrayMarker: z.union([z.string(), z.null()]).optional(),
}).optional();

/** Format options schema */
export const formatOptionsSchema = z.object({
  /** Enable type markers @default true */
  typed: z.boolean().optional(),
  /** Serialization options */
  serialize: serializationSchema,
  /** Parsing options */
  parse: parsingSchema,
  /** Separator configuration */
  separators: separatorsSchema,
  /** Type markers (typed mode only) */
  markers: markersSchema,
  /** Plain mode options */
  plain: plainModeSchema,
});

/** Format configuration options */
export type FormatOptions = z.input<typeof formatOptionsSchema>;

// =============================================================================
// INTERNAL: Convert options to internal format
// =============================================================================

function toInternalOptions(opts: FormatOptions = {}): {
  useTypeMarkers: boolean;
  nestingSeparator: string;
  arraySeparator: 'repeat' | string;
  booleanStyle: 'string' | 'number';
  arrayIndexStyle: 'dot' | 'bracket';
  emptyArrayMarker: string | null;
  stringMarker: string;
  primitiveMarker: string | false;
  arrayMarker: string | false;
  terminator: string;
  datePrefix: string | false;
  separator: string;
  escape: string;
  nullString: string;
  undefinedString: string;
  dateStyle: 'iso' | 'timestamp';
  autoParseNumbers: boolean;
  autoParseBooleans: boolean;
  autoParseDates: boolean;
} {
  const s = opts.separators ?? {};
  const m = opts.markers ?? {};
  const ser = opts.serialize ?? {};
  const p = opts.parse ?? {};
  const pl = opts.plain ?? {};
  const typed = opts.typed ?? true;
  
  return {
    useTypeMarkers: typed,
    nestingSeparator: s.nesting ?? '.',
    arraySeparator: s.array ?? ',',
    separator: s.entry ?? ',',
    escape: s.escape ?? '/',
    booleanStyle: ser.booleans ?? 'string',
    dateStyle: ser.dates ?? (typed ? 'timestamp' : 'iso'),
    nullString: ser.null ?? 'null',
    undefinedString: ser.undefined ?? 'undefined',
    stringMarker: m.string ?? '=',
    primitiveMarker: m.primitive ?? ':',
    arrayMarker: m.array ?? '@',
    terminator: m.terminator ?? '~',
    datePrefix: m.datePrefix ?? 'D',
    arrayIndexStyle: pl.arrayIndexStyle ?? 'dot',
    emptyArrayMarker: pl.emptyArrayMarker === undefined ? '__empty_array__' : pl.emptyArrayMarker,
    autoParseNumbers: p.numbers ?? true,
    autoParseBooleans: p.booleans ?? true,
    autoParseDates: p.dates ?? true,
  };
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateOptions(opts: FormatOptions): void {
  const i = toInternalOptions(opts);
  const errors: string[] = [];
  
  if (i.useTypeMarkers) {
    // Typed mode - check for plain-only options
    if (opts.plain !== undefined) {
      errors.push("'plain' options only apply when typed: false");
    }
    
    // Marker collision validation
    const markers: Array<{ name: string; value: string }> = [
      { name: 'markers.string', value: i.stringMarker },
      { name: 'separators.nesting', value: i.nestingSeparator },
      { name: 'separators.entry', value: i.separator },
      { name: 'markers.terminator', value: i.terminator },
    ];
    if (i.primitiveMarker !== false) {
      markers.push({ name: 'markers.primitive', value: i.primitiveMarker });
    }
    if (i.arrayMarker !== false) {
      markers.push({ name: 'markers.array', value: i.arrayMarker });
    }

    const seen = new Map<string, string>();
    for (const { name, value } of markers) {
      if (seen.has(value)) {
        errors.push(`Collision: '${name}' and '${seen.get(value)}' both use '${value}'`);
      } else {
        seen.set(value, name);
      }
    }

    if (seen.has(i.escape)) {
      errors.push(`Escape '${i.escape}' conflicts with '${seen.get(i.escape)}'`);
    }
  } else {
    // Plain mode - check for typed-only options
    if (opts.markers !== undefined) {
      errors.push("'markers' options only apply when typed: true");
    }
    
    // Separator collision validation
    if (i.arraySeparator !== 'repeat' && i.arraySeparator === i.nestingSeparator) {
      errors.push(`separators.array '${i.arraySeparator}' conflicts with separators.nesting`);
    }
    if (i.separator === i.nestingSeparator) {
      errors.push(`separators.entry '${i.separator}' conflicts with separators.nesting`);
    }
    if (i.escape === i.separator || i.escape === i.nestingSeparator || 
        (i.arraySeparator !== 'repeat' && i.escape === i.arraySeparator)) {
      errors.push(`separators.escape '${i.escape}' conflicts with another separator`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`[zustand-querystring] Invalid format configuration:\n  - ${errors.join('\n  - ')}`);
  }
}

// =============================================================================
// INTERNAL TYPES
// =============================================================================

// =============================================================================
// INTERNAL TYPES
// =============================================================================

interface FlatOpts {
  nestingSep: string;
  arraySep: 'repeat' | string;
  indexStyle: 'dot' | 'bracket';
  emptyMarker: string | null;
  sep: string;
  esc: string;
  nullStr: string;
  undefStr: string;
  boolStyle: 'string' | 'number';
  dateStyle: 'iso' | 'timestamp';
  parseNums: boolean;
  parseBools: boolean;
  parseDates: boolean;
}

interface CompactOpts {
  objMarker: string;
  arrMarker: string | false;
  strMarker: string;
  primMarker: string | false;
  sep: string;
  arraySep: string;
  term: string;
  esc: string;
  datePrefix: string | false;
  nullStr: string;
  undefStr: string;
  boolStyle: 'string' | 'number';
  dateStyle: 'iso' | 'timestamp';
  parseNums: boolean;
  parseBools: boolean;
  parseDates: boolean;
}

// =============================================================================
// PRIMITIVES - Each validation/parse logic appears exactly ONCE
// =============================================================================

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const TIMESTAMP_RE = /^-?\d+$/;  // Timestamps can be negative (before Unix epoch)

const isValidDate = (d: Date): boolean => !isNaN(d.getTime());

function tryParseNumber(s: string): number | null {
  if (!NUMBER_RE.test(s)) return null;
  const n = parseFloat(s);
  /* v8 ignore next -- @preserve: isFinite edge case for Infinity/NaN */
  return isFinite(n) ? n : null;
}

function tryParseBoolean(s: string, style: 'string' | 'number'): boolean | null {
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (style === 'number') {
    /* v8 ignore next -- @preserve */
    if (s === '1') return true;
    /* v8 ignore next -- @preserve */
    if (s === '0') return false;
  }
  return null;
}

function tryParseDate(s: string, style: 'iso' | 'timestamp', strict: boolean = false): Date | null {
  if (style === 'timestamp' && TIMESTAMP_RE.test(s)) {
    const ts = parseInt(s, 10);
    // When not strict (auto-parsing), only parse timestamps that are plausible dates (1990-3000)
    // This prevents small numbers like "12345" from being parsed as dates
    // When strict (explicit date prefix), parse any valid timestamp
    if (!strict) {
      const MIN_PLAUSIBLE_TS = 631152000000; // 1990-01-01
      const MAX_PLAUSIBLE_TS = 32503680000000; // 3000-01-01
      if (ts < MIN_PLAUSIBLE_TS || ts > MAX_PLAUSIBLE_TS) return null;
    }
    const d = new Date(ts);
    return isValidDate(d) ? d : null;
  }
  if (ISO_DATE_RE.test(s)) {
    const d = new Date(s);
    return isValidDate(d) ? d : null;
  }
  return null;
}

function serializeBoolean(b: boolean, style: 'string' | 'number'): string {
  return style === 'number' ? (b ? '1' : '0') : String(b);
}

function serializeDate(d: Date, style: 'iso' | 'timestamp'): string {
  return style === 'timestamp' ? String(d.getTime()) : d.toISOString();
}

// =============================================================================
// VALUE RESOLUTION - Single entry point for parsing any value
// =============================================================================

interface ResolveOpts {
  nullStr: string;
  undefStr: string;
  boolStyle: 'string' | 'number';
  dateStyle: 'iso' | 'timestamp';
  parseNums: boolean;
  parseBools: boolean;
  parseDates: boolean;
}

/**
 * Resolve a raw string to its typed value.
 * Linear flow: special strings → type hint → auto-parse → string fallback
 */
function resolveValue(raw: string, hint: unknown, opts: ResolveOpts): unknown {
  // Step 1: Unambiguous special strings
  if (raw === opts.nullStr) return null;
  if (raw === opts.undefStr) return undefined;
  if (raw === '') return '';

  // Step 2: Type hint coercion
  if (hint !== null && hint !== undefined) {
    if (typeof hint === 'string') return raw;
    
    if (typeof hint === 'number') {
      const n = tryParseNumber(raw);
      if (n !== null) return n;
    }
    
    if (typeof hint === 'boolean') {
      const b = tryParseBoolean(raw, opts.boolStyle);
      if (b !== null) return b;
    }
    
    if (hint instanceof Date) {
      const d = tryParseDate(raw, opts.dateStyle, true);
      if (d !== null) return d;
    }
    
    if (Array.isArray(hint) && hint[0] !== undefined) {
      return resolveValue(raw, hint[0], opts);
    }
  }

  // Step 3: Auto-parse (no hint or coercion failed)
  if (opts.parseBools) {
    const b = tryParseBoolean(raw, 'string');
    if (b !== null) return b;
  }
  
  if (opts.parseDates) {
    const d = tryParseDate(raw, opts.dateStyle);
    if (d !== null) return d;
  }
  
  if (opts.parseNums) {
    const n = tryParseNumber(raw);
    if (n !== null) return n;
  }

  return raw;
}

// =============================================================================
// ESCAPE UTILITIES
// =============================================================================

function escapeChars(str: string, chars: string[], esc: string): string {
  const pattern = new RegExp(
    `([${chars.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}])`,
    'g'
  );
  return str.replace(pattern, `${esc}$1`);
}

function unescape(str: string, esc: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    if (str[i] === esc && i + 1 < str.length) {
      result += str[++i];
    } else {
      result += str[i];
    }
  }
  return result;
}

function splitWithEscape(str: string, sep: string, esc: string): string[] {
  const result: string[] = [];
  let current = '';
  for (let i = 0; i < str.length; i++) {
    if (str[i] === esc && i + 1 < str.length) {
      // Escaped character - include the next char literally
      current += str[++i];
    } else if (str.slice(i, i + sep.length) === sep) {
      // Separator found - push current and skip separator
      result.push(current);
      current = '';
      i += sep.length - 1;
    } else {
      current += str[i];
    }
  }
  result.push(current);
  return result;
}

// =============================================================================
// PLAIN MODE
// =============================================================================

function resolveFlatOpts(o: FormatOptions = {}): FlatOpts {
  const i = toInternalOptions(o);
  return {
    nestingSep: i.nestingSeparator,
    arraySep: i.arraySeparator,
    indexStyle: i.arrayIndexStyle,
    emptyMarker: i.emptyArrayMarker,
    sep: i.separator,
    esc: i.escape,
    nullStr: i.nullString,
    undefStr: i.undefinedString,
    boolStyle: i.booleanStyle,
    dateStyle: i.dateStyle,
    parseNums: i.autoParseNumbers,
    parseBools: i.autoParseBooleans,
    parseDates: i.autoParseDates,
  };
}

function serializeFlatValue(v: unknown, opts: FlatOpts): string {
  if (v === null) return opts.nullStr;
  if (v === undefined) return opts.undefStr;
  if (typeof v === 'boolean') return serializeBoolean(v, opts.boolStyle);
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return serializeDate(v, opts.dateStyle);
  return String(v);
}

function flattenObject(
  obj: object,
  opts: FlatOpts,
  prefix: string,
  forNamespaced: boolean
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const escChars = [opts.esc, opts.sep, opts.nestingSep];

  for (const [rawKey, value] of Object.entries(obj)) {
    if (typeof value === 'function') continue;

    const key = forNamespaced ? escapeChars(rawKey, escChars, opts.esc) : rawKey;
    const fullKey = prefix ? prefix + opts.nestingSep + key : key;

    if (value === null || value === undefined || 
        typeof value === 'boolean' || typeof value === 'number' || 
        typeof value === 'string' || value instanceof Date) {
      const str = serializeFlatValue(value, opts);
      result[fullKey] = [forNamespaced ? escapeChars(str, [opts.esc, opts.sep], opts.esc) : str];
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        if (opts.emptyMarker !== null) {
          const marker = forNamespaced ? escapeChars(opts.emptyMarker, [opts.esc, opts.sep], opts.esc) : opts.emptyMarker;
          result[fullKey] = [marker];
        }
      } else {
        const hasObjects = value.some(v => 
          v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
        );
        if (hasObjects) {
          value.forEach((item, i) => {
            const indexKey = opts.indexStyle === 'bracket'
              ? fullKey + '[' + i + ']'
              : fullKey + opts.nestingSep + i;
            /* v8 ignore next 3 -- @preserve: rare nested object in array edge case */
            if (item !== null && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date)) {
              Object.assign(result, flattenObject(item, opts, indexKey, forNamespaced));
            } else {
              const str = serializeFlatValue(item, opts);
              result[indexKey] = [forNamespaced ? escapeChars(str, [opts.esc, opts.sep], opts.esc) : str];
            }
          });
        } else {
          result[fullKey] = value.map(v => {
            const str = serializeFlatValue(v, opts);
            if (forNamespaced) {
              return escapeChars(str, [opts.esc, opts.sep], opts.esc);
            } else if (opts.arraySep !== 'repeat') {
              // In standalone mode with non-repeat arraySep, escape the arraySep in values
              return escapeChars(str, [opts.esc, opts.arraySep], opts.esc);
            }
            return str;
          });
        }
      }
    } else if (typeof value === 'object') {
      Object.assign(result, flattenObject(value, opts, fullKey, forNamespaced));
    }
  }
  return result;
}

function getHintAtPath(init: object, parts: string[]): unknown {
  let cur: unknown = init;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    if (Array.isArray(cur)) {
      cur = cur[0];
      continue;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function parseKeyParts(key: string, opts: FlatOpts, handleEsc: boolean): string[] {
  const parts: string[] = [];
  let cur = '';
  let i = 0;
  
  while (i < key.length) {
    if (handleEsc && key[i] === opts.esc && i + 1 < key.length) {
      cur += key[++i];
      i++;
      continue;
    }
    
    if (opts.indexStyle === 'bracket' && key[i] === '[') {
      if (cur) parts.push(cur);
      cur = '';
      i++;
      while (i < key.length && key[i] !== ']') cur += key[i++];
      parts.push(cur);
      cur = '';
      i++;
      if (key.substring(i, i + opts.nestingSep.length) === opts.nestingSep) {
        i += opts.nestingSep.length;
      }
      continue;
    }
    
    if (key.substring(i, i + opts.nestingSep.length) === opts.nestingSep) {
      if (cur) parts.push(cur);
      cur = '';
      i += opts.nestingSep.length;
      continue;
    }
    
    cur += key[i++];
  }
  if (cur) parts.push(cur);
  return parts;
}

function setNested(obj: Record<string, unknown>, parts: string[], value: unknown): void {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (cur[part] === undefined) cur[part] = nextIsIndex ? [] : {};
    cur = cur[part] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) {
    (cur as unknown as unknown[])[parseInt(last, 10)] = value;
  } else {
    cur[last] = value;
  }
}

function unflattenObject(
  params: QueryStringParams,
  init: object,
  opts: FlatOpts,
  forNamespaced: boolean
): object {
  const grouped: Record<string, string[]> = {};
  
  for (const [key, values] of Object.entries(params)) {
    for (const v of values) {
      let decoded: string;
      if (forNamespaced) {
        decoded = unescape(v, opts.esc);
      } else {
        try { decoded = decodeURI(v); }
        catch { decoded = v; }
      }
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(decoded);
    }
  }

  const resolveOpts: ResolveOpts = {
    nullStr: opts.nullStr,
    undefStr: opts.undefStr,
    boolStyle: opts.boolStyle,
    dateStyle: opts.dateStyle,
    parseNums: opts.parseNums,
    parseBools: opts.parseBools,
    parseDates: opts.parseDates,
  };

  const result: Record<string, unknown> = {};
  const keys = Object.keys(grouped).sort((a, b) => {
    const pa = parseKeyParts(a, opts, forNamespaced);
    const pb = parseKeyParts(b, opts, forNamespaced);
    return pa.length !== pb.length ? pa.length - pb.length : a.localeCompare(b);
  });

  for (const key of keys) {
    let values = grouped[key];
    const parts = parseKeyParts(key, opts, forNamespaced);
    const hint = getHintAtPath(init, parts);
    const shouldBeArray = Array.isArray(hint);

    if (values.length === 1 && opts.emptyMarker !== null && values[0] === opts.emptyMarker) {
      setNested(result, parts, []);
      continue;
    }

    if (opts.arraySep !== 'repeat' && shouldBeArray && values.length === 1) {
      // Split by arraySep while respecting escape sequences
      values = splitWithEscape(values[0], opts.arraySep, opts.esc);
    }

    if (values.length === 1 && !shouldBeArray) {
      setNested(result, parts, resolveValue(values[0], hint, resolveOpts));
    } else {
      const elemHint = Array.isArray(hint) ? hint[0] : undefined;
      setNested(result, parts, values.map(v => resolveValue(v, elemHint, resolveOpts)));
    }
  }

  return result;
}

function createFlatFormat(options: FormatOptions): QueryStringFormat {
  const opts = resolveFlatOpts(options);

  return {
    stringify(state: object): string {
      const flat = flattenObject(state, opts, '', true);
      const parts: string[] = [];
      for (const [key, values] of Object.entries(flat)) {
        if (opts.arraySep === 'repeat') {
          for (const v of values) parts.push(key + '=' + v);
        } else {
          parts.push(key + '=' + values.join(opts.arraySep));
        }
      }
      return parts.join(opts.sep);
    },

    parse(value: string, ctx?: ParseContext): object {
      if (!value) return {};
      const params: QueryStringParams = {};
      let cur = '';
      let i = 0;
      
      while (i < value.length) {
        if (value[i] === opts.esc && i + 1 < value.length) {
          cur += value[i] + value[++i];
          i++;
        } else if (value[i] === opts.sep) {
          if (cur) {
            const eq = cur.indexOf('=');
            if (eq !== -1) {
              const k = cur.slice(0, eq), v = cur.slice(eq + 1);
              if (!params[k]) params[k] = [];
              params[k].push(v);
            }
          }
          cur = '';
          i++;
        } else {
          cur += value[i++];
        }
      }
      
      if (cur) {
        const eq = cur.indexOf('=');
        if (eq !== -1) {
          const k = cur.slice(0, eq), v = cur.slice(eq + 1);
          if (!params[k]) params[k] = [];
          params[k].push(v);
        }
      }
      
      return unflattenObject(params, ctx?.initialState ?? {}, opts, true);
    },

    stringifyStandalone(state: object): QueryStringParams {
      const flat = flattenObject(state, opts, '', false);
      const result: QueryStringParams = {};
      for (const [key, values] of Object.entries(flat)) {
        const encodedValues = values.map(v => encodeURI(v));
        result[key] = opts.arraySep === 'repeat' ? encodedValues : [encodedValues.join(opts.arraySep)];
      }
      return result;
    },

    parseStandalone(params: QueryStringParams, ctx: ParseContext): object {
      return unflattenObject(params, ctx.initialState, opts, false);
    },
  } as QueryStringFormat;
}

// =============================================================================
// TYPED MODE
// =============================================================================

function resolveCompactOpts(o: FormatOptions = {}): CompactOpts {
  const i = toInternalOptions(o);
  return {
    objMarker: i.nestingSeparator,
    arrMarker: i.arrayMarker,
    strMarker: i.stringMarker,
    primMarker: i.primitiveMarker,
    sep: i.separator,
    arraySep: i.arraySeparator,
    term: i.terminator,
    esc: i.escape,
    datePrefix: i.datePrefix,
    nullStr: i.nullString,
    undefStr: i.undefinedString,
    boolStyle: i.booleanStyle,
    dateStyle: i.dateStyle,
    parseNums: i.autoParseNumbers,
    parseBools: i.autoParseBooleans,
    parseDates: i.autoParseDates,
  };
}

function createCompactFormat(options: FormatOptions): QueryStringFormat {
  const opts = resolveCompactOpts(options);
  
  // Build character sets for escaping (filter out false values)
  const keyChars = [opts.strMarker, opts.primMarker, opts.arrMarker, opts.objMarker, opts.esc, opts.sep, opts.arraySep]
    .filter((c): c is string => c !== false);
  const valChars = [opts.sep, opts.arraySep, opts.term, opts.esc];
  
  const escRe = (c: string) => /[.$^*+?()[\]{}|\\]/.test(c) ? '\\' + c : c;
  const keyStop = new RegExp(`[${keyChars.map(escRe).join('')}]`);
  const valStop = new RegExp(`[${escRe(opts.sep)}${escRe(opts.arraySep)}${escRe(opts.term)}]`);

  function escKey(s: string): string {
    return encodeURI(escapeChars(s, keyChars, opts.esc));
  }

  function escVal(s: string): string {
    return encodeURI(escapeChars(s, valChars, opts.esc));
  }

  function serialize(v: unknown, standalone: boolean, inArray: boolean): string {
    // When primitiveMarker is disabled, use empty string for primitives in standalone mode
    /* v8 ignore next -- @preserve: primMarker default fallback rarely hit due to resolveopts */
    const pm = standalone && opts.primMarker === false ? '' : (opts.primMarker || ':');
    
    if (v === null) return pm + opts.nullStr;
    if (v === undefined) return pm + opts.undefStr;
    if (typeof v === 'function') return '';

    if (typeof v === 'number') {
      return pm + String(v).replace(/\./g, opts.esc + '.');
    }

    if (typeof v === 'boolean') {
      return pm + serializeBoolean(v, opts.boolStyle);
    }

    if (v instanceof Date) {
      const dateVal = serializeDate(v, opts.dateStyle);
      if (opts.datePrefix === false) {
        return standalone ? dateVal : opts.strMarker + dateVal;
      }
      return opts.strMarker + opts.datePrefix + dateVal;
    }

    if (Array.isArray(v)) {
      const items = v.map(x => serialize(x, standalone, true));
      // When arrayMarker is disabled in standalone mode, just join items
      if (opts.arrMarker === false && standalone) {
        return items.join(opts.arraySep);
      }
      /* v8 ignore next -- @preserve: arrMarker default fallback rarely hit due to resolveopts */
      const am = opts.arrMarker || '@';
      return am + items.join(opts.arraySep) + opts.term;
    }

    if (typeof v === 'object') {
      const entries: string[] = [];
      for (const [k, val] of Object.entries(v)) {
        const s = serialize(val, false, false);
        if (s || val === undefined) entries.push(escKey(k) + s);
      }
      return opts.objMarker + entries.join(opts.sep) + opts.term;
    }

    // String
    let escaped = escVal(String(v));
    
    // Escape if looks like date prefix
    if (opts.datePrefix !== false && new RegExp(`^${opts.datePrefix}-?\\d`).test(String(v))) {
      escaped = opts.esc + escaped;
    }

    // In arrays or standalone mode, escape leading type markers
    if ((inArray || standalone) && escaped.length > 0) {
      const first = escaped[0];
      if (first === opts.strMarker || 
          (opts.primMarker !== false && first === opts.primMarker) || 
          (opts.arrMarker !== false && first === opts.arrMarker) || 
          first === opts.objMarker) {
        escaped = opts.esc + escaped;
      }
    }

    if (inArray && escaped === '') return opts.strMarker;
    return standalone || inArray ? escaped : opts.strMarker + escaped;
  }

  function cleanResult(s: string, standalone: boolean): string {
    // Strip trailing terminators, but not if they're escaped
    while (s.endsWith(opts.term) && !s.endsWith(opts.esc + opts.term)) {
      s = s.slice(0, -opts.term.length);
    }
    if (standalone && s.startsWith(opts.strMarker + opts.datePrefix)) return s.slice(1);
    if (!standalone && s.startsWith(opts.objMarker)) return s.slice(1);
    return s;
  }

  function parse(input: string, standalone: boolean, hint?: unknown): unknown {
    const str = decodeURI(input);
    if (!str) return standalone ? '' : {};

    const first = str[0];
    // Check if first char is a known marker (only check markers that are enabled)
    const hasMarker = first === opts.strMarker || 
                      (opts.primMarker !== false && first === opts.primMarker) ||
                      (opts.arrMarker !== false && first === opts.arrMarker) || 
                      first === opts.objMarker;

    let src: string;
    if (hasMarker) {
      src = str;
    } else if (standalone) {
      // Handle date with prefix - use strict mode since prefix explicitly marks it as date
      if (opts.datePrefix !== false && str.startsWith(opts.datePrefix as string)) {
        const dateVal = str.slice((opts.datePrefix as string).length);
        const d = tryParseDate(dateVal, opts.dateStyle, true);
        if (d) return d;
      }
      // Handle date without prefix (auto-detect when datePrefix is false and autoParseDates is enabled)
      if (opts.datePrefix === false && opts.parseDates) {
        const d = tryParseDate(str, opts.dateStyle);
        if (d) return d;
      }
      return unescape(str, opts.esc);
    } else {
      // Namespaced: detect if it's an object structure
      // Build markers list, filtering out disabled ones
      const activeMarkers = [opts.strMarker, opts.primMarker, opts.arrMarker, opts.objMarker]
        .filter((m): m is string => m !== false);
      const markersPattern = activeMarkers.map(escRe).join('');
      const objTest = new RegExp(`[^${escRe(opts.esc)}${markersPattern}${escRe(opts.sep)}${escRe(opts.term)}][${markersPattern}]`);
      src = objTest.test(str) ? opts.objMarker + str : opts.strMarker + str;
    }

    let pos = 0;
    const peek = () => src[pos] || '';
    const advance = () => pos++;

    function readUntil(stop: RegExp): { val: string; escaped: boolean } {
      let result = '';
      let escaped = false;
      while (pos < src.length) {
        if (src[pos] === opts.esc) {
          if (pos + 1 < src.length && src[pos + 1] === opts.datePrefix) escaped = true;
          advance();
          if (pos < src.length) { result += peek(); advance(); }
          continue;
        }
        if (stop.test(peek())) break;
        result += peek();
        advance();
      }
      return { val: result, escaped };
    }

    function parseString(): string | Date {
      const { val, escaped } = readUntil(valStop);
      // When datePrefix is set, use strict mode (trust the prefix)
      if (opts.datePrefix !== false && !escaped && val.startsWith(opts.datePrefix as string)) {
        const dateVal = val.slice((opts.datePrefix as string).length);
        const d = tryParseDate(dateVal, opts.dateStyle, true);
        if (d) return d;
      }
      // When datePrefix is false, use non-strict auto-parsing
      if (opts.datePrefix === false && !escaped) {
        const d = tryParseDate(val, opts.dateStyle, false);
        if (d) return d;
      }
      return val;
    }

    function parsePrimitive(): number | boolean | null | undefined {
      const { val } = readUntil(valStop);
      if (val === opts.nullStr) return null;
      if (val === opts.undefStr) return undefined;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return parseFloat(val);
    }

    function parseArray(elemHint?: unknown): unknown[] {
      const result: unknown[] = [];
      let lastWasSep = false;

      while (pos < src.length && peek() !== opts.term) {
        if (peek() === opts.arraySep) {
          result.push('');
          advance();
          lastWasSep = true;
          continue;
        }
        lastWasSep = false;
        
        const ch = peek();
        if (ch === opts.primMarker || ch === opts.arrMarker || 
            ch === opts.objMarker || ch === opts.strMarker) {
          result.push(parseValue(elemHint));
        } else {
          result.push(parseString());
        }
        
        if (peek() === opts.arraySep) { advance(); lastWasSep = true; }
      }

      if (lastWasSep) result.push('');
      if (peek() === opts.term) advance();
      return result;
    }

    function parseObject(objHint?: object): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      while (pos < src.length && peek() !== opts.term) {
        const { val: key } = readUntil(keyStop);
        const propHint = objHint ? (objHint as Record<string, unknown>)[key] : undefined;
        result[key] = parseValue(propHint);
        if (peek() === opts.sep) advance();
      }
      if (peek() === opts.term) advance();
      return result;
    }

    function parseValue(valHint?: unknown): unknown {
      const type = peek();
      advance();
      
      if (type === opts.primMarker) {
        const prim = parsePrimitive();
        // Coerce 0/1 to boolean if hint says boolean
        /* v8 ignore next 4 -- @preserve: compound condition edge cases */
        if (opts.boolStyle === 'number' && typeof valHint === 'boolean' && typeof prim === 'number') {
          if (prim === 1) return true;
          if (prim === 0) return false;
        }
        return prim;
      }
      
      if (type === opts.arrMarker) {
        const elemHint = Array.isArray(valHint) ? valHint[0] : undefined;
        return parseArray(elemHint);
      }
      
      if (type === opts.objMarker) {
        const objHint = typeof valHint === 'object' && valHint && !Array.isArray(valHint) ? valHint : undefined;
        return parseObject(objHint as object | undefined);
      }
      
      /* v8 ignore next -- @preserve */
      if (type === opts.strMarker) {
        const s = parseString();
        // If string but hint is Date, try coercion - use strict mode
        /* v8 ignore next -- @preserve */
        if (valHint instanceof Date && typeof s === 'string') {
          /* v8 ignore next -- @preserve */
          const d = tryParseDate(s, opts.dateStyle, true);
          /* v8 ignore next -- @preserve */
          if (d) return d;
        }
        return s;
      }
      
      // Defensive: unreachable in normal operation since parseValue is only called
      // when peek() matches one of the known type markers (primMarker, arrMarker, objMarker, strMarker)
      /* v8 ignore next -- @preserve */
      throw new Error(`Unexpected type "${type}" at ${pos}`);
    }

    return parseValue(hint);
  }

  // Auto-parse a string value when markers are disabled
  function autoParseValue(val: string, hint: unknown): unknown {
    // First check special strings
    if (val === opts.nullStr) return null;
    if (val === opts.undefStr) return undefined;
    
    // Type hint coercion (highest priority)
    if (hint !== null && hint !== undefined) {
      if (typeof hint === 'string') return val;
      if (typeof hint === 'number') {
        const n = tryParseNumber(val);
        if (n !== null) return n;
      }
      if (typeof hint === 'boolean') {
        const b = tryParseBoolean(val, opts.boolStyle);
        if (b !== null) return b;
      }
      if (hint instanceof Date) {
        const d = tryParseDate(val, opts.dateStyle, true);
        if (d !== null) return d;
      }
    }
    
    // Auto-parse based on opts
    if (opts.parseBools) {
      const b = tryParseBoolean(val, 'string');
      if (b !== null) return b;
    }
    if (opts.parseDates) {
      const d = tryParseDate(val, opts.dateStyle);
      if (d !== null) return d;
    }
    if (opts.parseNums) {
      const n = tryParseNumber(val);
      if (n !== null) return n;
    }
    
    return val;
  }
  
  // Validate that standalone-only options aren't used in namespaced mode
  function validateNamespacedMode(): void {
    const standaloneOnlyOptions: string[] = [];
    if (opts.primMarker === false) standaloneOnlyOptions.push('primitiveMarker: false');
    if (opts.arrMarker === false) standaloneOnlyOptions.push('arrayMarker: false');
    
    if (standaloneOnlyOptions.length > 0) {
      throw new Error(
        `[zustand-querystring] Invalid configuration for namespaced mode: ${standaloneOnlyOptions.join(', ')} ` +
        `can only be used in standalone mode (key: false in querystring options). ` +
        `In namespaced mode, where the entire state is serialized into a single string, ` +
        `these markers are required for unambiguous parsing.`
      );
    }
  }

  return {
    stringify(state: object): string {
      validateNamespacedMode();
      return cleanResult(serialize(state, false, false), false);
    },

    parse(value: string, ctx?: ParseContext): object {
      validateNamespacedMode();
      return parse(value, false, ctx?.initialState) as object;
    },

    stringifyStandalone(state: object): QueryStringParams {
      const result: QueryStringParams = {};
      for (const [key, v] of Object.entries(state)) {
        result[key] = [cleanResult(serialize(v, true, false), true)];
      }
      return result;
    },

    parseStandalone(params: QueryStringParams, ctx: ParseContext): object {
      const result: Record<string, unknown> = {};
      const init = ctx.initialState as Record<string, unknown> | undefined;

      for (const [key, values] of Object.entries(params)) {
        try {
          const hint = init?.[key];
          const val = values[0];

          // Handle arrayMarker: false - arrays become comma-separated values
          if (opts.arrMarker === false && Array.isArray(hint)) {
            if (val === '') {
              result[key] = [];
              continue;
            }
            const elemHint = hint[0];
            const items = val.split(opts.arraySep);
            result[key] = items.map(item => {
              // If primitiveMarker is also false, auto-parse each item
              if (opts.primMarker === false) {
                return autoParseValue(item, elemHint);
              }
              return parse(item, true, elemHint);
            });
            continue;
          }

          let parsed = parse(val, true, hint);
          
          // When primitiveMarker is disabled and we got a string back, try auto-parsing
          if (opts.primMarker === false && typeof parsed === 'string') {
            parsed = autoParseValue(parsed, hint);
          }
          
          result[key] = parsed;
        } catch {
          // skip invalid
        }
      }
      return result;
    },
  };
}

// =============================================================================
// FACTORY & PRESETS
// =============================================================================

export function createFormat(options: FormatOptions = {}): QueryStringFormat {
  // Validate options
  validateOptions(options);
  
  const i = toInternalOptions(options);
  return i.useTypeMarkers ? createCompactFormat(options) : createFlatFormat(options);
}

/** Plain format preset - types inferred from initialState */
export const plain: QueryStringFormat = createFormat({ typed: false, separators: { array: 'repeat' } });

/** Typed format preset - self-describing with type markers */
export const typed: QueryStringFormat = createFormat({ typed: true });
