/**
 * URL-Safe Serialization
 * 
 * Inspired by URLON (https://github.com/cerebral/urlon)
 * Copyright (c) 2021 Cerebral - MIT License
 */

// Configuration
const TYPE_OBJECT = '.';
const TYPE_ARRAY = '@';
const TYPE_STRING = '=';
const TYPE_PRIMITIVE = ':';
const SEPARATOR = ',';
const TERMINATOR = '~';
const ESCAPE = '/';
const DATE_PREFIX = '!Date:';

// Build regex patterns from config
const SEP_CHAR = SEPARATOR[0];
const esc = (c: string) => /[.$^*+?()[\]{}|\\]/.test(c) ? `\\${c}` : c;

const KEY_STOP = new RegExp(`[${TYPE_STRING}${TYPE_PRIMITIVE}${TYPE_ARRAY}${esc(TYPE_OBJECT)}${esc(SEP_CHAR)}]`);
const VALUE_STOP = new RegExp(`[${esc(SEP_CHAR)}${TERMINATOR}]`);
const KEY_ESCAPE = new RegExp(`([${TYPE_STRING}${TYPE_PRIMITIVE}${TYPE_ARRAY}${esc(TYPE_OBJECT)}${ESCAPE}${esc(SEP_CHAR)}])`, 'g');
const VALUE_ESCAPE = new RegExp(`([${esc(SEP_CHAR)}${TERMINATOR}${ESCAPE}])`, 'g');

function escapeStr(str: string, pattern: RegExp): string {
  return encodeURI(str.replace(pattern, `${ESCAPE}$1`));
}

function cleanResult(str: string): string {
  while (str.endsWith(TERMINATOR)) str = str.slice(0, -1);
  if (str.startsWith(TYPE_OBJECT) || str.startsWith(TYPE_ARRAY)) {
    str = str.slice(1);
  }
  return str;
}

// === SERIALIZE ===

export function stringify(value: unknown): string {
  return cleanResult(serialize(value));
}

function serialize(value: unknown): string {
  if (value === null) return `${TYPE_PRIMITIVE}null`;
  if (value === undefined) return `${TYPE_PRIMITIVE}undefined`;
  if (typeof value === 'function') return '';
  
  if (typeof value === 'number') {
    return `${TYPE_PRIMITIVE}${String(value).replace(/\./g, `${ESCAPE}.`)}`;
  }
  
  if (typeof value === 'boolean') {
    return `${TYPE_PRIMITIVE}${value}`;
  }
  
  if (value instanceof Date) {
    return `${TYPE_STRING}${DATE_PREFIX}${escapeStr(value.toISOString(), VALUE_ESCAPE)}`;
  }
  
  if (Array.isArray(value)) {
    const items = value.map(v => serialize(v));
    return `${TYPE_ARRAY}${items.join(SEPARATOR)}${TERMINATOR}`;
  }
  
  if (typeof value === 'object') {
    const entries: string[] = [];
    for (const [k, v] of Object.entries(value)) {
      const val = serialize(v);
      if (val || v === undefined) {
        entries.push(`${escapeStr(k, KEY_ESCAPE)}${val}`);
      }
    }
    return `${TYPE_OBJECT}${entries.join(SEPARATOR)}${TERMINATOR}`;
  }
  
  return `${TYPE_STRING}${escapeStr(String(value), VALUE_ESCAPE)}`;
}

// === PARSE ===

export function parse<T = unknown>(input: string): T {
  const str = decodeURI(input);
  const first = str[0];
  const hasMarker = first === TYPE_STRING || first === TYPE_PRIMITIVE || 
                    first === TYPE_ARRAY || first === TYPE_OBJECT;
  
  let pos = 0;
  const source = hasMarker ? str : `${TYPE_OBJECT}${str}`;
  
  function readUntil(pattern: RegExp): string {
    let result = '';
    while (pos < source.length) {
      const char = source[pos];
      if (char === ESCAPE) {
        pos++;
        result += pos < source.length ? source[pos++] : TERMINATOR;
        continue;
      }
      if (pattern.test(char)) break;
      result += char;
      pos++;
    }
    return result;
  }
  
  function skipSeparator(): void {
    if (source[pos] === SEPARATOR) {
      pos++;
    }
  }
  
  function parseString(): string | Date {
    const val = readUntil(VALUE_STOP);
    if (val.startsWith(DATE_PREFIX)) {
      return new Date(val.slice(DATE_PREFIX.length));
    }
    return val;
  }
  
  function parsePrimitive(): number | boolean | null | undefined {
    const val = readUntil(VALUE_STOP);
    if (val === 'null') return null;
    if (val === 'undefined') return undefined;
    if (val === 'true') return true;
    if (val === 'false') return false;
    return parseFloat(val);
  }
  
  function parseArray(): unknown[] {
    const result: unknown[] = [];
    while (pos < source.length && source[pos] !== TERMINATOR) {
      result.push(parseValue());
      if (pos < source.length && source[pos] !== TERMINATOR) {
        skipSeparator();
      }
    }
    if (source[pos] === TERMINATOR) pos++;
    return result;
  }
  
  function parseObject(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    while (pos < source.length && source[pos] !== TERMINATOR) {
      const key = readUntil(KEY_STOP);
      result[key] = parseValue();
      if (pos < source.length && source[pos] !== TERMINATOR) {
        skipSeparator();
      }
    }
    if (source[pos] === TERMINATOR) pos++;
    return result;
  }
  
  function parseValue(): unknown {
    const type = source[pos++];
    
    switch (type) {
      case TYPE_STRING: return parseString();
      case TYPE_PRIMITIVE: return parsePrimitive();
      case TYPE_ARRAY: return parseArray();
      case TYPE_OBJECT: return parseObject();
      default: throw new Error(`Unexpected type "${type}" at position ${pos - 1}`);
    }
  }
  
  return parseValue() as T;
}
